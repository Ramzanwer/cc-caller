# 📞 cc-caller

让 Claude Code 在完成任务或遇到困难时，能够"打电话"给你！

## 🎯 功能特性

- **🔔 来电通知**: Claude Code 可以发起"电话"呼叫
- **🎤 语音交互**: 使用 TTS 播放 Claude 的消息，STT 识别你的回复
- **⚡ 紧急程度**: 支持 4 级紧急程度（低/正常/高/紧急）
- **💬 双向通信**: 实时语音或文字回复
- **🌐 Web 应用**: 在浏览器中接收来电

## 🏗️ 系统架构

```
┌──────────────┐     ┌──────────────────┐     ┌──────────────────┐
│ Claude Code  │────▶│   MCP Server     │────▶│   后端服务       │
│              │     │ (caller-mcp)     │     │ (WebSocket)      │
└──────────────┘     └──────────────────┘     └────────┬─────────┘
                                                       │
                           ┌───────────────────────────┘
                           ▼
                    ┌──────────────────┐
                    │   用户端 Web App  │
                    │  (React + TTS/STT)│
                    └──────────────────┘
```

## 📦 项目结构

```
cc-caller/
├── mcp-server/          # MCP 服务器 (供 Claude Code 使用)
│   ├── src/
│   │   ├── index.ts     # 入口
│   │   ├── tools/       # MCP 工具定义
│   │   ├── services/    # WebSocket 客户端
│   │   └── schemas/     # Zod 验证
│   └── package.json
│
├── backend/             # 后端服务
│   ├── src/
│   │   ├── index.ts     # Express + WebSocket 服务
│   │   └── services/    # 通话管理器
│   └── package.json
│
└── frontend/            # 用户端 Web 应用
    ├── src/
    │   ├── App.tsx
    │   ├── components/  # React 组件
    │   └── hooks/       # 自定义 Hooks
    └── package.json
```

## 🚀 快速开始

### 1. 启动后端服务

```bash
cd backend
npm install
npm run dev
```

后端将在 `http://localhost:3001` 启动

### 2. 启动前端应用

```bash
cd frontend
npm install
npm run dev
```

前端将在 `http://localhost:3000` 启动

## 🐳 Docker 一键部署（前后端同域名/同端口）

本项目提供根目录 `Dockerfile`，会在构建阶段打包前端（Vite build），并由后端 Express 在运行时托管静态文件。

```bash
docker compose up --build
```

默认访问 `http://localhost:3000`（同域名下 WebSocket 也走该端口）。

注意：如果你的机器提示找不到 `docker` 命令，请先安装 Docker Desktop 并确保已加入 PATH。

## ☁️ 部署到 Cloudflare Workers + Containers

Cloudflare Containers 官方使用说明见：[`Cloudflare Containers docs`](https://developers.cloudflare.com/containers/llms-full.txt)。

本仓库已提供最小可用的 Worker 配置，位于 `cloudflare-worker/`：

```bash
cd cloudflare-worker
npm install
npx wrangler deploy
```

部署完成后，你会得到一个 Worker URL。该 Worker 会把 HTTP/WebSocket 请求转发到容器实例（容器镜像使用仓库根目录 `Dockerfile` 构建）。

### 使用 GitHub Actions 自动部署（不需要本机 Docker）

如果你的电脑无法使用 Docker，可以使用 GitHub Actions 在 Linux runner 上自动构建并部署（runner 自带 Docker，适配 Containers 的构建流程；参考官方说明：[`Cloudflare Containers docs`](https://developers.cloudflare.com/containers/llms-full.txt)）。

仓库已新增 workflow：`.github/workflows/cloudflare-deploy.yml`，默认在 `main` 分支 push 时触发，也支持手动触发（workflow_dispatch）。

你需要在 GitHub 仓库的 Secrets 中配置：

- `CLOUDFLARE_API_TOKEN`: Cloudflare API Token（需要具备 Workers/Containers 部署权限）
- `CLOUDFLARE_ACCOUNT_ID`: Cloudflare Account ID

配置完成后，推送到 `main`（或在 Actions 页面手动运行）即可自动执行：
`wrangler deploy --config cloudflare-worker/wrangler.toml`

### 3. 配置 Claude Code

在你的 Claude Code 配置中添加 MCP 服务器：

**方式一：本地 stdio 模式**

```json
{
  "mcpServers": {
    "cc-caller": {
      "command": "node",
      "args": ["/path/to/cc-caller/mcp-server/dist/index.js"],
      "env": {
        "CALLER_WS_URL": "ws://localhost:3001"
      }
    }
  }
}
```

**方式二：HTTP 模式**

```bash
cd mcp-server
npm install
TRANSPORT=http PORT=3002 npm start
```

然后在配置中使用：

```json
{
  "mcpServers": {
    "cc-caller": {
      "url": "http://localhost:3002/mcp"
    }
  }
}
```

## 🛠️ MCP 工具说明

### `call_user`

发起语音电话给用户。

**参数:**
- `message` (string): 要说的内容
- `urgency` (string): 紧急程度 - `low` | `normal` | `high` | `critical`
- `context` (string, 可选): 上下文信息
- `wait_for_response` (boolean): 是否等待用户回复

**示例:**

```typescript
// Claude Code 完成任务后
call_user({
  message: "我已经完成了代码重构，所有 47 个测试都通过了！",
  urgency: "normal",
  context: "重构认证模块"
});

// 遇到问题需要帮助
call_user({
  message: "我遇到了问题，API 返回 403 错误，找不到凭据。请问凭据文件在哪里？",
  urgency: "high",
  context: "API 集成"
});
```

### `send_message_in_call`

在活跃通话中发送额外消息。

### `wait_for_reply`

等待用户的语音回复。

### `end_call`

结束当前通话。

## 🎨 用户界面

### 待机状态
- 显示连接状态
- 等待来电

### 来电状态
- 铃声提醒
- 显示紧急程度
- 预览消息内容
- 接听/拒接按钮

### 通话状态
- TTS 播放 Claude 的消息
- 显示对话历史
- 语音输入（STT）
- 文字输入
- 通话计时

## 🔧 技术栈

- **MCP Server**: TypeScript + @modelcontextprotocol/sdk
- **Backend**: Node.js + Express + WebSocket
- **Frontend**: React + Vite + TailwindCSS
- **语音**: Web Speech API (TTS/STT)

## 📝 注意事项

1. **浏览器支持**: 语音功能需要支持 Web Speech API 的浏览器（Chrome 推荐）
2. **麦克风权限**: 使用语音回复需要允许麦克风访问
3. **网络连接**: 需要保持 WebSocket 连接

## 🔮 未来计划

- [ ] 支持 Twilio 真实电话
- [ ] 移动端 PWA 支持
- [ ] 推送通知
- [ ] 通话历史记录
- [ ] 多用户支持

## 📄 License

MIT
