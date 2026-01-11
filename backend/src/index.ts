import express from "express";
import cors from "cors";
import { WebSocketServer, WebSocket } from "ws";
import { createServer } from "http";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { callManager } from "./services/callManager.js";
import { MessageType, CallRequest, WSMessage } from "./types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// Create HTTP server
const server = createServer(app);

// Create WebSocket server
const wss = new WebSocketServer({ server });

// Health check endpoint
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    ...callManager.getStats()
  });
});

// Stats endpoint
app.get("/stats", (_req, res) => {
  res.json(callManager.getStats());
});

// Serve built frontend if present (e.g. in Docker/production)
const staticDir = process.env.STATIC_DIR || path.join(__dirname, "public");
if (fs.existsSync(staticDir)) {
  app.use(express.static(staticDir));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(staticDir, "index.html"));
  });
}

// Handle WebSocket connections
wss.on("connection", (ws: WebSocket) => {
  console.log("[Server] New WebSocket connection");

  ws.on("message", (data: Buffer) => {
    try {
      const message: WSMessage = JSON.parse(data.toString());
      handleMessage(ws, message);
    } catch (error) {
      console.error("[Server] Failed to parse message:", error);
    }
  });

  ws.on("close", () => {
    console.log("[Server] WebSocket connection closed");
    callManager.removeClient(ws);
  });

  ws.on("error", (error) => {
    console.error("[Server] WebSocket error:", error);
  });
});

// Handle incoming messages
function handleMessage(ws: WebSocket, message: WSMessage): void {
  console.log(`[Server] Received message type: ${message.type}`);

  switch (message.type) {
    case MessageType.REGISTER: {
      const payload = message.payload as { userId?: string; clientType?: string };
      const clientType = payload.userId === "claude-code" ? "claude" : "user";
      callManager.registerClient(ws, clientType, payload.userId);
      break;
    }

    case MessageType.INITIATE_CALL: {
      const request = message.payload as unknown as CallRequest;
      callManager.initiateCall(request);
      break;
    }

    case MessageType.CALL_ACCEPTED: {
      const payload = message.payload as { callId: string };
      callManager.acceptCall(payload.callId);
      break;
    }

    case MessageType.CALL_REJECTED: {
      const payload = message.payload as { callId: string };
      callManager.rejectCall(payload.callId);
      break;
    }

    case MessageType.USER_RESPONSE: {
      const payload = message.payload as { callId: string; userMessage: string };
      callManager.handleUserResponse(payload.callId, payload.userMessage);
      break;
    }

    case MessageType.SEND_MESSAGE: {
      const payload = message.payload as { callId: string; message: string };
      callManager.sendMessageInCall(payload.callId, payload.message);
      break;
    }

    case MessageType.HEARTBEAT: {
      callManager.updateHeartbeat(ws);
      // Echo heartbeat back
      ws.send(JSON.stringify({
        type: MessageType.HEARTBEAT,
        payload: {},
        timestamp: Date.now()
      }));
      break;
    }

    default:
      console.log(`[Server] Unknown message type: ${message.type}`);
  }
}

// Start server
const PORT = parseInt(process.env.PORT || "3001");

server.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║           🔔 cc-caller Backend Server 🔔                   ║
╠════════════════════════════════════════════════════════════╣
║                                                            ║
║  HTTP Server:  http://localhost:${PORT}                      ║
║  WebSocket:    ws://localhost:${PORT}                        ║
║                                                            ║
║  Endpoints:                                                ║
║    GET /health  - Health check                             ║
║    GET /stats   - Connection stats                         ║
║                                                            ║
║  Waiting for connections...                                ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
  `);
});
