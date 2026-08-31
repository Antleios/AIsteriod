# Autism Rehab Web

一个面向自闭症康复训练的 AI Web 平台。

## 技术栈

- React 19 + Vite 8
- TailwindCSS v4
- React Router v7

## UI 风格

- 极简 + 科技感 + 医疗蓝白渐变
- 卡通化、柔和色彩、儿童友好
- 手绘绘本风（颜色连线游戏）
- 响应式设计（支持平板/PC）

## 页面路由

| 路径 | 页面 | 说明 |
|------|------|------|
| `/` | Home | 医疗 AI 平台首页 |
| `/patient` | PatientSelect | 患者端：选择训练游戏 / AI 对话 |
| `/patient/games` | Patient | 游戏列表 |
| `/patient/ai-chat` | AIChat | AI 对话（视频通话） |
| `/object-game` | ObjectNamingGame | 物品命名游戏（语音交互） |
| `/color-game` | ColorLineGame | 颜色连线游戏（拖拽配对） |
| `/emoji-game` | EmojiGame | 表情匹配游戏（情绪识别） |

## 游戏功能

### 物品命名游戏
- AI 语音提问 "请说出图片上的物品名称"
- 浏览器语音识别 / 文字输入备选
- 实时反馈正确/错误，自动加载下一题
- 20 种日常物品题库

### 颜色连线游戏
- 拖拽彩色物品到同色目标上配对
- 5 种颜色 × 2 个物品 = 10 个元素
- 实时 SVG 连线反馈，配对成功脉冲动画
- 配对手感：按住 → 拖拽 → 松手

### 表情匹配游戏
- 显示目标情绪词，4 个 emoji 选项
- 点击选择匹配表情
- 10 组情绪（开心/悲伤/愤怒/害怕等）

## AI 对话（视频通话）

`/patient/ai-chat`，居中一个会动的吉祥物「小星」，模拟视频通话对话：

- **动画吉祥物**（`AiMascot`）：头身一体的圆润造型 + 扁款蓝色针织帽；眼睛**跟随鼠标**移动（rAF 直接写 SVG transform，零重渲染）；眨眼、说话张嘴（TTS 播报时嘴型同步）、空闲轻微起伏
- **按住说话**：按住麦克风 → 浏览器语音识别 → AI 回复 → `speechSynthesis` 中文语音播报
- **状态机**：连接中 → 接通（问候语）→ 挂断；挂断后显示通话时长 + 「重新呼叫 / 返回」
- 真实 AI 未接入时，用 **mock 回复**演示完整流程

## 可复用组件

- `Navbar` — 顶部导航
- `ProgressBar` — 今日训练进度条
- `AIAvatar` — AI 卡通头像 + 语音气泡（游戏内）
- `AiMascot` — 动画吉祥物小星（眼睛跟随鼠标，视频通话页用）
- `RewardPopup` — 星星粒子庆祝动画

## 项目结构

```
src/
├── components/     # 可复用组件
├── pages/          # 页面
├── data/           # Mock 数据
├── api/            # 预留 API 接口
├── assets/         # 图片资源
├── App.jsx         # 路由配置
├── index.css       # TailwindCSS 入口
└── main.jsx        # 入口
```

## 开发

```bash
npm run dev      # 启动开发服务器
npm run build    # 生产构建
npm run preview  # 预览生产构建
```

## 后端与题库数据库

v1 后端位于 `server/`，使用 Express + Prisma + SQLite 提供题库 API。数据库按“每个游戏一张表”组织：

- `ObjectNamingQuestion`：物品命名题库
- `EmojiMatchQuestion`：表情匹配题库，选项存储在 `optionsJson`
- `ColorLineConfig`：颜色连线配置和颜色池

```bash
cd server
npm install
cp .env.example .env
npx prisma migrate deploy
npm run db:seed
npm run dev
```

前端开发服务器已代理 `/api` 到 `http://localhost:3001`。后端不可用时，三个游戏会继续回退到 `src/data/*.js` 本地题库。

## AI 接入与语音

普通对话与游戏自由提问已接入会话 API，默认使用百炼 Qwen Plus；所有页面播报统一支持 Qwen3-TTS-Instruct-Flash 温柔语音。详见 [AI_SETUP.md](server/AI_SETUP.md) 的 API 选型、费用、环境变量与验证说明。

在 server/.env 或后端部署平台配置 QWEN_API_KEY 后重启。不要将密钥放入前端或 Git。游戏规则判分与自由提问分开处理，缺少密钥时会明确提示。

当前已实现患者/医生登录、训练数据落库、医患关联权限与医生端记录查看；上文早期页面说明以当前代码和 AI_SETUP.md 为准。
