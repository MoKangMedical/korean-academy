# 🇰🇷 Korean Academy - 韩语学习平台

> 零基础到流利，互动式韩语学习 Web App

## ✨ 功能

- 📚 **课程体系**：课程 → 单元 → 课时 三级结构
- 🔊 **语音互动**：每个单词/例句点击即发音（浏览器 TTS，韩语原生语音）
- ✏️ **智能练习**：选择题 / 填空题 / 听力题
- 📊 **学习追踪**：进度统计、正确率、学习天数
- 📱 **移动端优化**：手机浏览器完美适配

## 🚀 快速开始

```bash
# 启动后端（需先部署到服务器）
cd backend && source venv/bin/activate && uvicorn main:app --host 0.0.0.0 --port 8104

# 前端直接用浏览器打开
open index.html
```

## 🏗️ 架构

```
浏览器 (HTML/CSS/JS)  ←→  FastAPI Backend (:8104)  ←→  SQLite
      ↑                        ↑
   GitHub Pages           东京服务器
```

## 📖 技术栈

- **前端**: 原生 HTML/CSS/JS (零框架依赖)
- **语音**: Web Speech API (SpeechSynthesis, ko-KR)
- **后端**: Python FastAPI + SQLAlchemy + SQLite
- **部署**: GitHub Pages + systemd + Nginx

## 📝 许可

MIT License
