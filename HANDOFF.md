# Korean Academy — Codex 接手文档

> **双端架构：GitHub Pages/新加坡 Nginx 前端 + 新加坡 FastAPI 代理 + 东京 FastAPI 上游**

---

## 一、项目概览

| 维度 | 详情 |
|------|------|
| **产品名** | 文文的韩语老师 |
| **GitHub Pages** | https://mokangmedical.github.io/korean-academy/ |
| **主域名** | https://koreanacademy.cn/ |
| **后端API** | https://koreanacademy.cn/korean-api |
| **微信小程序** | 本仓库 `miniprogram/` (AppID: wx3bfed43762c89c86) |

---

## 二、代码仓库

### 前端: `/root/korean-academy-web/`
**GitHub:** `https://github.com/MoKangMedical/korean-academy` (master分支)
**部署:** GitHub Pages 自动从master部署

| 文件 | 大小 | 说明 |
|------|------|------|
| `index.html` | 122KB | **主SPA** — 15个页面+全部JS内联（2626行→2900+行） |
| `css/style.css` | 80KB | 全局样式（暗黑金主题，430px移动端壳） |
| `js/api.js` | 22KB | API客户端（598行），18个端点 |
| `js/songs.js` | 6KB | 歌曲数据 |
| `manifest.json` | PWA清单 |
| `sw.js` | Service Worker（已禁用） |
| `scripts/gen_course_audio_v3.py` | 音频流水线脚本 |
| `miniprogram/` | 微信小程序工程（首页/课程/课时音频/发音/我的） |

### 小程序: `miniprogram/`

用微信开发者工具导入 `miniprogram/`。公众平台需配置：

| 类型 | 域名 |
|------|------|
| request合法域名 | `https://koreanacademy.cn` |
| uploadFile合法域名 | `https://koreanacademy.cn` |
| downloadFile合法域名 | `https://koreanacademy.cn` |

小程序端复用 `https://koreanacademy.cn/korean-api`，录音参数统一为 `24000Hz / mono / 48kbps`。

### 后端: 新加坡 API 代理 + 东京上游
**公网入口:** `https://koreanacademy.cn/korean-api`
**新加坡服务器:** `43.128.114.201`
**代理路径:** `/opt/korean-academy-proxy/backend/`
**代理服务:** `korean-academy-proxy.service` (systemd, `127.0.0.1:8104`)
**上游:** `https://eterna-niannian.cloud/korean-api`

普通 API 由代理透传到东京上游；`/tts` 和 `/tts/lesson/*` 音频会经新加坡代理用 ffmpeg 统一为 `MP3 / 24000Hz / mono / 48kbps / loudnorm` 后返回。

### 上游: 东京服务器
**IP:** 43.134.3.158
**路径:** `/opt/korean-academy/backend/`
**服务:** `korean-academy.service` (systemd, port 8104)

| 目录/文件 | 说明 |
|-----------|------|
| `backend/main.py` | FastAPI入口 |
| `backend/routers/` | 17个路由模块 |
| `backend/korean_academy.db` | SQLite数据库（1.8MB，WAL模式） |
| `backend/audio_cache/` | 508个预生成MP3课程音频 |

---

## 三、页面系统（15页）

| 页面ID | 名称 | 状态 |
|--------|------|:--:|
| page-home | 学习首页 | ✅ |
| page-courses | 课程列表（按级别筛选） | ✅ |
| page-course-detail | 课程详情（单元+课时树） | ✅ |
| page-lesson | 课时内容+音频播放器 | ✅ v3.0新增音频 |
| page-quiz | 练习题 | ✅ |
| page-quiz-result | 练习结果 | ✅ |
| page-songs | 韩语歌曲列表 | ✅ |
| page-song-detail | 歌曲详情 | ✅ |
| page-voice | 发音练习（录音评分） | ✅ |
| page-flashcard | 闪卡复习 | ✅ |
| page-daily | 每日挑战 | ✅ |
| page-achievements | 成就系统 | ✅ |
| page-leaderboard | 排行榜 | ✅ |
| page-chat | AI韩语对话 | ✅ |
| page-profile | 个人中心 | ✅ |

---

## 四、API端点（17个路由）

| 路由 | 前缀 | 关键端点 |
|------|------|---------|
| auth.py | `/api/auth` | POST `/wx-login` |
| courses.py | `/api/courses` | GET `/`, GET `/{id}`, GET `/lessons/{id}` |
| vocabulary.py | `/api/vocabulary` | GET `?lesson_id=X` |
| grammar.py | `/api/grammar` | GET `?lesson_id=X` |
| quiz.py | `/api/quiz` | GET `/exercises`, POST `/submit` |
| progress.py | `/api/progress` | GET `/`, POST `/update` |
| daily.py | `/api/daily` | GET `/`, POST `/submit` |
| flashcard.py | `/api/flashcard` | GET `/due`, POST `/review` |
| chat.py | `/api/chat` | POST `/` (DeepSeek) |
| tts.py | `/api/tts` | GET `/tts`, GET `/tts/lesson/{id}` |
| topik.py | `/api/topik` | GET `/questions`, POST `/submit` |
| grammar_practice.py | `/api/grammar-practice` | GET, POST |
| writing.py | `/api/writing` | POST `/submit`, GET `/history` |
| listening.py | `/api/listening` | GET, POST |
| reading.py | `/api/reading` | GET, POST |
| search.py | `/api/search` | GET `?q=&type=` |

---

## 五、v3.0 本轮新增（2026-05-17）

| 改动 | 文件 | 效果 |
|------|------|------|
| API_BASE远程化 | `js/api.js` | `/korean-api` → `https://koreanacademy.cn/korean-api` |
| KoreanTTS对象 | `index.html` | 26处调用点全部可用（词汇/语法/闪卡/播客） |
| 课程音频播放器 | `index.html` | 每课顶部音频栏 `🎧 课程音频 → [▶ 播放]` |
| showPage修复 | `index.html` | `style.display` 确保页面正确隐藏 |
| SW禁用 | `index.html` | 移除Service Worker缓存 |
| CSS版本 | `index.html` | v11→v12 |
| 音频流水线脚本 | `scripts/gen_course_audio_v3.py` | DeepSeek→edge_tts→ffmpeg标准流水线 |

---

## 六、音频流水线标准

三层叠加确保"好听"：

| 层 | 工具 | 参数 |
|---|------|------|
| ① 口播稿 | DeepSeek (`deepseek-chat`) | 150-230字自然导入稿 |
| ② TTS | edge_tts | `zh-CN-YunyangNeural`, rate=-8%, pitch=-2Hz |
| ③ 后期 | ffmpeg | `loudnorm=I=-16:TP=-1.5:LRA=9`, 24000Hz, mono, 48kbps |

**脚本位置：**
- 本地: `/root/korean-academy-web/scripts/gen_course_audio_v3.py`
- 东京上游: `/root/scripts/gen_course_audio_v3.py` (43.134.3.158)

**运行方式：**
```bash
ssh root@43.134.3.158
DEEPSEEK_API_KEY="sk-xxx" python3 /root/scripts/gen_course_audio_v3.py --dry-run
DEEPSEEK_API_KEY="sk-xxx" python3 /root/scripts/gen_course_audio_v3.py
```

**后端已有音频：** 508个MP3文件在 `/opt/korean-academy/backend/audio_cache/`

---

## 七、已知陷阱（CRITICAL）

### 1. API Client 注入位置
API client (`js/api.js`) 作为独立文件加载。**不能**把 `KoreanTTS` 或其他函数注入到 `api.js` 中 — 所有函数必须在 `index.html` 的内联 `<script>` 中。

### 2. Service Worker 缓存
已禁用SW注册，但 Nginx 端务必配置 `Cache-Control: no-cache`。否则浏览器缓存旧HTML。

### 3. Google Fonts 被墙
`fonts.googleapis.com` 在中国被屏蔽。**任何 `<link>` 引用都会导致30-60秒黑屏。** 已从 index.html 移除。系统字体回退：PingFang SC / Microsoft YaHei。

### 4. showPage display:none
CSS中 `.page` 没有 `display:none` 规则。必须用内联 `style.display` 控制可见性。

### 5. CORS
后端需配置 CORS 允许 `https://mokangmedical.github.io`。当前已配置。

### 6. 数据库 WAL 模式
SQLite需WAL模式避免并发锁：`PRAGMA journal_mode=WAL;`

---

## 八、部署检查清单

```bash
# 前端验证
curl -sk 'https://mokangmedical.github.io/korean-academy/' | grep -c 'API_BASE'    # ≥1
curl -sk 'https://mokangmedical.github.io/korean-academy/' | grep -c 'playLessonAudio'  # ≥1
curl -sk 'https://mokangmedical.github.io/korean-academy/' | grep -c 'fonts.googleapis'  # 必须=0

# 后端验证
curl -sk https://koreanacademy.cn/korean-api/health
curl -sk https://koreanacademy.cn/korean-api/courses | python3 -c "import sys,json; print(len(json.load(sys.stdin)),'courses')"
curl -skI https://koreanacademy.cn/korean-api/tts/lesson/1 | grep content-type  # audio/mpeg

# 服务器验证
ssh ubuntu@43.128.114.201 'systemctl status korean-academy-proxy --no-pager | head -5'
curl -skL -o /tmp/lesson1.mp3 https://koreanacademy.cn/korean-api/tts/lesson/1
ffprobe -v error -select_streams a:0 -show_entries stream=codec_name,sample_rate,channels,bit_rate -of default=nw=1 /tmp/lesson1.mp3
```

---

## 九、内容统计

| 资源 | 数量 |
|------|:--:|
| 课程 | 6门 |
| 单元 | 29个 |
| 课时 | 500课 |
| 词汇 | 2502个 |
| 练习题 | 1500道 |
| 语法点 | 500个 |
| 预生成音频 | 508个MP3 |
| 数据库表 | 16个 |
| API路由 | 17个 |
| 前端页面 | 15个 |
