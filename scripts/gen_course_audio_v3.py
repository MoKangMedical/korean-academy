#!/usr/bin/env python3
"""
Korean Academy — 课程音频生成流水线 v3.0
===========================================
标准流水线（三层叠加确保"好听"）：
1. DeepSeek 写"课程口播稿"（150-230字自然导入稿，不像机器念网页）
2. edge_tts 神经合成（zh-CN-YunyangNeural 男声，rate -6%~-8%, pitch -2Hz）
3. ffmpeg 统一后期（loudnorm=I=-16:TP=-1.5:LRA=9, 24000Hz, mono, MP3 48kbps）

输出目录: /opt/korean-academy/backend/audio_cache/
文件命名: lesson_{id}.mp3

用法:
  python3 gen_course_audio_v3.py                    # 生成全部缺失音频
  python3 gen_course_audio_v3.py --lesson 1         # 仅生成某一课
  python3 gen_course_audio_v3.py --dry-run           # 预览将要生成的内容
  python3 gen_course_audio_v3.py --skip-existing     # 跳过已有文件（默认）
  python3 gen_course_audio_v3.py --force             # 强制重新生成全部
"""

import os
import re
import sys
import json
import asyncio
import sqlite3
import hashlib
import argparse
import tempfile
import subprocess
from pathlib import Path

# ═══════════════════════════════════════════════
# 配置
# ═══════════════════════════════════════════════

DB_PATH = "/opt/korean-academy/backend/korean_academy.db"
AUDIO_DIR = "/opt/korean-academy/backend/audio_cache"

# DeepSeek API
DEEPSEEK_API_KEY = os.environ.get("DEEPSEEK_API_KEY", "")
DEEPSEEK_BASE = "https://api.deepseek.com/v1"

# TTS 参数（按用户指定标准）
TTS_VOICE = "zh-CN-YunyangNeural"  # 中文男声神经音色
TTS_RATE = "-8%"                   # 慢速，沉稳（-6% ~ -8%）
TTS_PITCH = "-2Hz"                 # 低音调，避免机器急促感

# ffmpeg 参数（按用户指定标准）
FFMPEG_ARGS = [
    "-ar", "24000",           # 采样率 24000Hz
    "-ac", "1",               # 单声道
    "-b:a", "48k",            # 48kbps（网页和小程序友好）
    "-af", "loudnorm=I=-16:TP=-1.5:LRA=9",  # 响度标准化
    "-f", "mp3",
]

# ═══════════════════════════════════════════════
# 步骤1: DeepSeek 写课程口播稿
# ═══════════════════════════════════════════════

ORAL_SCRIPT_SYSTEM_PROMPT = """你是韩语课程的口播稿撰写专家。任务是把课程正文压缩成150-230字的自然导入稿。
要求：
1. 听起来像老师在讲课，不像机器逐字念网页
2. 保留2-3个关键韩语例句，用中文解释意思
3. 语气温和、有停顿感，适合语音合成
4. 以"同学们好，欢迎来到..."或类似的自然开场
5. 结尾说"我们开始学习吧"之类的过渡语
6. 纯中文输出，韩语词汇保留原样"""

ORAL_SCRIPT_USER_TEMPLATE = """请为以下韩语课程写一段口播稿（150-230字）：

课程标题：{title}
课程内容：
{content}

要求：自然、有节奏、适合朗读。"""

async def generate_oral_script(title: str, content: str) -> str:
    """用 DeepSeek 生成课程口播稿"""
    import httpx
    
    # 截取前500字符作为课程内容摘要
    content_preview = content[:500].strip()
    
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"{DEEPSEEK_BASE}/chat/completions",
            headers={
                "Authorization": f"Bearer {DEEPSEEK_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": "deepseek-chat",
                "messages": [
                    {"role": "system", "content": ORAL_SCRIPT_SYSTEM_PROMPT},
                    {"role": "user", "content": ORAL_SCRIPT_USER_TEMPLATE.format(
                        title=title, content=content_preview
                    )},
                ],
                "max_tokens": 400,
                "temperature": 0.7,
            },
        )
        data = resp.json()
        script = data["choices"][0]["message"]["content"].strip()
        return script


# ═══════════════════════════════════════════════
# 步骤2: edge_tts 神经合成
# ═══════════════════════════════════════════════

async def synthesize_speech(text: str, output_path: str) -> bool:
    """用 edge_tts 合成语音（临时MP3，未经ffmpeg处理）"""
    import edge_tts
    
    communicate = edge_tts.Communicate(
        text=text,
        voice=TTS_VOICE,
        rate=TTS_RATE,
        pitch=TTS_PITCH,
    )
    await communicate.save(output_path)
    return os.path.exists(output_path) and os.path.getsize(output_path) > 100


# ═══════════════════════════════════════════════
# 步骤3: ffmpeg 统一后期
# ═══════════════════════════════════════════════

def post_process_audio(input_path: str, output_path: str) -> bool:
    """ffmpeg 响度标准化 + 格式统一"""
    cmd = [
        "ffmpeg", "-y",
        "-i", input_path,
        *FFMPEG_ARGS,
        output_path,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    return result.returncode == 0 and os.path.getsize(output_path) > 500


# ═══════════════════════════════════════════════
# 主流程：生成单课音频
# ═══════════════════════════════════════════════

async def generate_lesson_audio(lesson_id: int, title: str, content: str, 
                                  force: bool = False) -> dict:
    """完整流水线：DeepSeek口播稿 → edge_tts → ffmpeg"""
    output_file = os.path.join(AUDIO_DIR, f"lesson_{lesson_id}.mp3")
    
    # 检查是否已存在
    if not force and os.path.exists(output_file) and os.path.getsize(output_file) > 5000:
        return {"status": "skipped", "lesson_id": lesson_id, "reason": "exists"}
    
    result = {"status": "pending", "lesson_id": lesson_id, "title": title}
    
    try:
        # 步骤1: 生成口播稿
        print(f"  [{lesson_id}] 步骤1: DeepSeek 生成口播稿...")
        script = await generate_oral_script(title, content)
        script_len = len(script)
        print(f"  [{lesson_id}] 口播稿: {script_len}字")
        result["script_len"] = script_len
        
        # 步骤2: TTS 合成
        print(f"  [{lesson_id}] 步骤2: edge_tts 合成 ({TTS_VOICE}, rate={TTS_RATE})...")
        tmp_raw = os.path.join(AUDIO_DIR, f"_tmp_{lesson_id}.mp3")
        success = await synthesize_speech(script, tmp_raw)
        if not success:
            result["status"] = "failed"
            result["error"] = "TTS synthesis failed"
            return result
        
        raw_size = os.path.getsize(tmp_raw)
        print(f"  [{lesson_id}] 原始音频: {raw_size} bytes")
        
        # 步骤3: ffmpeg 后期
        print(f"  [{lesson_id}] 步骤3: ffmpeg 响度标准化...")
        success = post_process_audio(tmp_raw, output_file)
        os.unlink(tmp_raw)  # 清理临时文件
        
        if not success:
            result["status"] = "failed"
            result["error"] = "ffmpeg post-processing failed"
            return result
        
        final_size = os.path.getsize(output_file)
        result["status"] = "success"
        result["size"] = final_size
        result["script"] = script[:100] + "..."
        print(f"  [{lesson_id}] ✅ 完成: {final_size} bytes → {output_file}")
        
    except Exception as e:
        result["status"] = "failed"
        result["error"] = str(e)
        print(f"  [{lesson_id}] ❌ 失败: {e}")
    
    return result


# ═══════════════════════════════════════════════
# 批量生成
# ═══════════════════════════════════════════════

async def main():
    parser = argparse.ArgumentParser(description="Korean Academy 课程音频生成流水线 v3.0")
    parser.add_argument("--lesson", type=int, help="仅生成指定课时")
    parser.add_argument("--course", type=int, help="仅生成指定课程的所有课时")
    parser.add_argument("--dry-run", action="store_true", help="预览模式")
    parser.add_argument("--force", action="store_true", help="强制重新生成")
    parser.add_argument("--limit", type=int, default=0, help="限制生成数量")
    args = parser.parse_args()
    
    # 检查依赖
    if not DEEPSEEK_API_KEY:
        print("❌ 请设置 DEEPSEEK_API_KEY 环境变量")
        sys.exit(1)
    
    try:
        import edge_tts
    except ImportError:
        print("❌ 请安装 edge_tts: pip install edge-tts")
        sys.exit(1)
    
    # 连接数据库
    os.makedirs(AUDIO_DIR, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # 查询课时
    if args.lesson:
        cursor.execute("SELECT id, title, content FROM lessons WHERE id = ?", (args.lesson,))
    elif args.course:
        cursor.execute("""
            SELECT l.id, l.title, l.content FROM lessons l
            JOIN units u ON l.unit_id = u.id
            WHERE u.course_id = ?
            ORDER BY l.id
        """, (args.course,))
    else:
        cursor.execute("SELECT id, title, content FROM lessons ORDER BY id")
    
    lessons = cursor.fetchall()
    total = len(lessons)
    print(f"📊 共 {total} 课时")
    
    if args.dry_run:
        for row in lessons[:10]:
            print(f"  课时 {row['id']}: {row['title']} ({len(row['content'] or '')} 字)")
        print(f"  ... 共 {total} 课时")
        return
    
    # 逐课生成
    results = {"success": 0, "skipped": 0, "failed": 0, "details": []}
    count = 0
    
    for row in lessons:
        if args.limit and count >= args.limit:
            break
        
        lesson_id = row["id"]
        title = row["title"]
        content = row["content"] or ""
        
        if not content.strip():
            print(f"  [{lesson_id}] ⏭ 跳过（无内容）")
            results["skipped"] += 1
            continue
        
        print(f"\n📖 课时 {lesson_id}: {title}")
        
        result = await generate_lesson_audio(lesson_id, title, content, force=args.force)
        results[result["status"]] = results.get(result["status"], 0) + 1
        results["details"].append(result)
        
        count += 1
        await asyncio.sleep(1)  # API 限速
    
    # 汇总
    print(f"\n{'='*50}")
    print(f"✅ 完成: {results.get('success', 0)}")
    print(f"⏭ 跳过: {results.get('skipped', 0)}")
    print(f"❌ 失败: {results.get('failed', 0)}")
    
    # 验证音频规范
    print(f"\n🔍 音频规范验证（抽样检查）:")
    sample_files = sorted(Path(AUDIO_DIR).glob("lesson_*.mp3"))[:3]
    for f in sample_files:
        probe = subprocess.run(
            ["ffprobe", "-v", "quiet", "-show_entries", 
             "stream=codec_name,sample_rate,channels,bit_rate",
             "-of", "csv=p=0", str(f)],
            capture_output=True, text=True
        )
        print(f"  {f.name}: {probe.stdout.strip()}")
    
    conn.close()

if __name__ == "__main__":
    asyncio.run(main())
