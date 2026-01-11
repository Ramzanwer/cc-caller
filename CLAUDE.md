# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

cc-caller is a voice call bridge that enables Claude Code to "call" users via WebSocket-based real-time communication. Users receive call notifications in a web app with TTS/STT capabilities for voice interaction.

## Architecture

```
Claude Code (MCP Server) → Backend (Express + WebSocket) → Frontend (React PWA)
```

- **mcp-server/**: MCP tools for Claude Code integration (`call_user`, `send_message_in_call`, `wait_for_reply`, `end_call`)
- **backend/**: Express server with WebSocket handling, manages call lifecycle and client connections
- **frontend/**: React + Vite PWA with TTS/STT for voice interaction
- **cloudflare-worker/**: Cloudflare Workers deployment configuration

## Build Commands

### Backend
```bash
cd backend
npm run build     # Compile TypeScript
npm run dev       # Development with tsx watch
npm start         # Run production
```

### Frontend
```bash
cd frontend
npm run build     # Vite build to dist/
npm run dev       # Dev server on port 3000
```

### MCP Server
```bash
cd mcp-server
npm run build     # Compile TypeScript
npm start         # Run as stdio transport (default)
TRANSPORT=http PORT=3002 npm start  # Run as HTTP server
```

### Full Stack Development
```bash
./start.sh        # Starts backend (3001) + frontend (3000)
```

### Docker
```bash
docker compose up --build   # Unified on port 3000
```

## Claude Code MCP Configuration

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

## Key Technical Details

- **Call States**: pending → ringing → connected → completed
- **Call Timeout**: 60 seconds for unanswered calls, 2 minutes for response wait
- **Urgency Levels**: low, normal, high, critical
- **WebSocket Reconnection**: Exponential backoff (max 5 attempts, up to 30s delay)
- **CallManager** (`backend/src/services/callManager.ts`): Core call lifecycle management
- **CallerService** (`mcp-server/src/services/caller.ts`): Singleton WebSocket client with async callbacks

## Message Protocol

Key WebSocket message types: `INITIATE_CALL`, `CALL_ACCEPTED`, `CALL_REJECTED`, `USER_RESPONSE`, `SEND_MESSAGE`, `TTS_MESSAGE`, `HEARTBEAT`, `CALL_STATUS`, `REGISTER`
