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

## 可复用组件

- `Navbar` — 顶部导航
- `ProgressBar` — 今日训练进度条
- `AIAvatar` — AI 卡通头像 + 语音气泡
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

## 备注

- 当前阶段不实现登录，默认视为已登录
- 语音数据与完成记录预留同步医生端接口
- 游戏进度使用 localStorage 持久化
