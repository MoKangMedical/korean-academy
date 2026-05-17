# 🇰🇷 文文的韩语老师

> 零基础到流利，文文的专属韩语学习助手

## ✨ 功能

- 📚 **课程体系**：课程 → 单元 → 课时 三级结构
- 🎵 **韩语歌曲**：7首经典韩语歌，逐句歌词 + 词汇拆解 + 填空练习
- 🔊 **语音互动**：每个单词/例句/歌词点击即发音（浏览器原生韩语TTS）
- ✏️ **智能练习**：选择题 / 填空题 / 听力题 / 歌词填空
- 📊 **学习追踪**：进度统计、正确率
- 📱 **移动端优化**：手机浏览器完美适配

## 🎵 歌曲库

| 歌曲 | 类型 | 难度 |
|------|------|------|
| 아리랑 (阿里郎) | 传统民谣 | Lv.1 |
| 곰 세 마리 (三只熊) | 儿歌 | Lv.1 |
| 생일 축하합니다 (生日快乐) | 节日歌 | Lv.1 |
| 고향의 봄 (故乡之春) | 童谣 | Lv.2 |
| 반달 (半月) | 童谣 | Lv.2 |
| 너에게 난 (你之于我) | 独立音乐 | Lv.2 |
| 봄날 - BTS | K-POP | Lv.3 |

## 🚀 快速开始

```bash
# 浏览器打开
open index.html
```

## 🌐 GitHub Pages

线上页面已由 `master` 分支自动部署：

```text
https://mokangmedical.github.io/korean-academy/
```

前端直接调用新域名后端代理：

```text
https://koreanacademy.cn/korean-api
```

## 📱 微信小程序

小程序工程在 `miniprogram/`，用微信开发者工具导入该目录即可。

```text
AppID: wx3bfed43762c89c86
项目目录: miniprogram/
```

微信公众平台需要配置服务器域名：

```text
request合法域名: https://koreanacademy.cn
uploadFile合法域名: https://koreanacademy.cn
downloadFile合法域名: https://koreanacademy.cn
```

当前小程序已包含：首页、课程、课时音频、发音练习、个人页。

## 🔊 音频质量统一

统一规格：MP3, 24000Hz, mono, 48kbps, `loudnorm=I=-16:TP=-1.5:LRA=9`。

```bash
# 在东京后端统一已有课程音频，不重新调用 DeepSeek/TTS
python3 scripts/gen_course_audio_v3.py --normalize-existing --force
python3 scripts/gen_course_audio_v3.py --verify-all

# 统一其他发音/上传/参考音频目录
python3 scripts/normalize_audio_quality.py /opt/korean-academy/backend/pronunciation_uploads --pattern '*' --force
python3 scripts/normalize_audio_quality.py /opt/korean-academy/backend/pronunciation_uploads --pattern '*.mp3' --verify
```

前端录音会请求 `24000Hz / mono / 48kbps`，并随上传附带 `sample_rate/channel_count/bit_rate/loudness` 元数据；最终落盘仍建议后端用上述脚本二次归一化。

## 🏗️ 架构

```
浏览器 (HTML/CSS/JS)  ←→  FastAPI (:8104)  ←→  SQLite
      ↑
   GitHub Pages
```

## 📖 技术栈

- **前端**: 原生 HTML/CSS/JS (零框架)
- **语音**: Web Speech API (SpeechSynthesis ko-KR)
- **后端**: Python FastAPI + SQLAlchemy + SQLite
- **部署**: GitHub Pages + systemd + Nginx
