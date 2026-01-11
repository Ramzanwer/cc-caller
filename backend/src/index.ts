import express from "express";
import cors from "cors";
import { WebSocketServer, WebSocket } from "ws";
import { createServer } from "http";
import { randomUUID } from "crypto";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { callManager } from "./services/callManager.js";
import { MessageType, CallRequest, WSMessage } from "./types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

const PORT = parseInt(process.env.PORT || "3001");

// Create HTTP server
const server = createServer(app);

// Create WebSocket server
const wss = new WebSocketServer({ server });

// ---- MCP over SSE (for remote Claude App) ----

// Note: This intentionally uses SSE transport for compatibility with remote MCP clients.
// The transport is deprecated in the SDK but remains widely used for remote clients.
const mcpServer = new McpServer({
  name: "cc-caller-mcp-server",
  version: "1.0.0"
});

// Zod schemas mirror mcp-server/src/schemas/index.ts to keep tool behavior consistent.
const UrgencyLevelSchema = z.enum(["low", "normal", "high", "critical"]);

const CallUserInputSchema = z.object({
  message: z.string().min(1, "Message cannot be empty").max(2000, "Message too long, max 2000 characters"),
  urgency: UrgencyLevelSchema.default("normal"),
  context: z.string().max(500).optional(),
  wait_for_response: z.boolean().default(true)
}).strict();

type CallUserInput = z.infer<typeof CallUserInputSchema>;

const SendMessageInputSchema = z.object({
  call_id: z.string().min(1),
  message: z.string().min(1).max(2000)
}).strict();

type SendMessageInput = z.infer<typeof SendMessageInputSchema>;

const WaitForReplyInputSchema = z.object({
  call_id: z.string().min(1),
  timeout_seconds: z.number().int().min(5).max(300).default(60)
}).strict();

type WaitForReplyInput = z.infer<typeof WaitForReplyInputSchema>;

const EndCallInputSchema = z.object({
  call_id: z.string().min(1),
  farewell_message: z.string().max(500).optional()
}).strict();

type EndCallInput = z.infer<typeof EndCallInputSchema>;

type CallStatusPayload = {
  callId: string;
  status: string;
  duration?: number;
  userResponse?: string;
  error?: string;
};

type UserResponsePayload = {
  callId: string;
  userMessage: string;
  timestamp: number;
};

type CallbackFn = (result: CallStatusPayload) => void;
type ResponseCallbackFn = (response: UserResponsePayload) => void;

class LocalCallerService {
  private ws: WebSocket | null = null;
  private wsUrl: string;
  private callCallbacks: Map<string, CallbackFn> = new Map();
  private responseCallbacks: Map<string, ResponseCallbackFn> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private isConnecting = false;
  private connectionPromise: Promise<void> | null = null;

  constructor(wsUrl: string) {
    this.wsUrl = wsUrl;
  }

  async connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    if (this.isConnecting && this.connectionPromise) {
      return this.connectionPromise;
    }

    this.isConnecting = true;
    this.connectionPromise = new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.wsUrl);

        this.ws.on("open", () => {
          console.log("[LocalCallerService] Connected to backend WebSocket");
          this.reconnectAttempts = 0;
          this.isConnecting = false;

          // Register as Claude client so CallManager will route status updates to us.
          this.sendMessage({
            type: MessageType.REGISTER,
            payload: { userId: "claude-code" },
            timestamp: Date.now()
          });

          resolve();
        });

        this.ws.on("message", (data) => {
          try {
            const message = JSON.parse(data.toString()) as WSMessage;
            this.handleMessage(message);
          } catch (error) {
            console.error("[LocalCallerService] Failed to parse message:", error);
          }
        });

        this.ws.on("close", () => {
          console.log("[LocalCallerService] Connection closed");
          this.isConnecting = false;
          this.attemptReconnect();
        });

        this.ws.on("error", (error) => {
          console.error("[LocalCallerService] WebSocket error:", (error as Error).message);
          this.isConnecting = false;
          reject(error);
        });
      } catch (error) {
        this.isConnecting = false;
        reject(error);
      }
    });

    return this.connectionPromise;
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error("[LocalCallerService] Max reconnection attempts reached");
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    console.log(`[LocalCallerService] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    setTimeout(() => {
      this.connect().catch((err) => console.error("[LocalCallerService] Reconnect failed:", err));
    }, delay);
  }

  private handleMessage(message: WSMessage): void {
    switch (message.type) {
      case MessageType.CALL_STATUS: {
        const payload = message.payload as unknown as CallStatusPayload;
        const callback = this.callCallbacks.get(payload.callId);
        if (callback) {
          callback(payload);
          if (payload.status === "completed" || payload.status === "failed" || payload.status === "no_answer") {
            this.callCallbacks.delete(payload.callId);
          }
        }
        break;
      }

      case MessageType.USER_RESPONSE: {
        const payload = message.payload as unknown as UserResponsePayload;
        const callback = this.responseCallbacks.get(payload.callId);
        if (callback) {
          callback(payload);
          this.responseCallbacks.delete(payload.callId);
        }
        break;
      }

      case MessageType.HEARTBEAT: {
        // Respond to heartbeat
        this.sendMessage({
          type: MessageType.HEARTBEAT,
          payload: {},
          timestamp: Date.now()
        });
        break;
      }

      default:
        // Ignore other messages
        break;
    }
  }

  private sendMessage(message: WSMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn("[LocalCallerService] WebSocket not connected");
    }
  }

  async initiateCall(request: CallRequest): Promise<CallStatusPayload> {
    await this.connect();

    return new Promise((resolve) => {
      this.callCallbacks.set(request.callId, (result) => {
        if (result.status === "completed" || result.status === "failed" || result.status === "no_answer") {
          resolve(result);
        }
      });

      this.sendMessage({
        type: MessageType.INITIATE_CALL,
        payload: request as unknown as Record<string, unknown>,
        timestamp: Date.now()
      });

      // Safety timeout (mirrors mcp-server behavior)
      setTimeout(() => {
        if (this.callCallbacks.has(request.callId)) {
          this.callCallbacks.delete(request.callId);
          resolve({
            callId: request.callId,
            status: "no_answer",
            error: "Call timed out - no answer from user"
          });
        }
      }, 120000);
    });
  }

  async waitForResponse(callId: string, timeoutMs: number): Promise<UserResponsePayload | null> {
    await this.connect();

    return new Promise((resolve) => {
      this.responseCallbacks.set(callId, (response) => resolve(response));

      setTimeout(() => {
        if (this.responseCallbacks.has(callId)) {
          this.responseCallbacks.delete(callId);
          resolve(null);
        }
      }, timeoutMs);
    });
  }

  async sendTextMessage(callId: string, message: string): Promise<void> {
    await this.connect();

    this.sendMessage({
      type: MessageType.SEND_MESSAGE,
      payload: {
        callId,
        message,
        timestamp: Date.now()
      },
      timestamp: Date.now()
    });
  }
}

const localCallerService = new LocalCallerService(`ws://127.0.0.1:${PORT}`);

function registerMcpTools(): void {
  mcpServer.registerTool(
    "call_user",
    {
      title: "Call User",
      description: "Initiate a voice call to the user to report progress or ask for help.",
      inputSchema: CallUserInputSchema
    },
    async (params: CallUserInput) => {
      const callId = randomUUID();

      try {
        console.log(`[call_user] Initiating call ${callId} with urgency: ${params.urgency}`);

        const result = await localCallerService.initiateCall({
          callId,
          message: params.message,
          urgency: params.urgency as unknown as CallRequest["urgency"],
          context: params.context,
          requiresResponse: params.wait_for_response,
          timestamp: Date.now()
        });

        if (result.status === "completed") {
          const output = {
            success: true,
            call_id: callId,
            status: "completed",
            user_response: result.userResponse || null,
            duration_seconds: result.duration ? Math.round(result.duration / 1000) : null
          };

          let textResponse = `✅ Call completed successfully.`;
          if (result.userResponse) {
            textResponse += `\n\n**User said:** "${result.userResponse}"`;
          }
          if (result.duration) {
            textResponse += `\n\nCall duration: ${Math.round(result.duration / 1000)} seconds`;
          }

          return {
            content: [{ type: "text", text: textResponse }],
            structuredContent: output
          };
        }

        if (result.status === "no_answer") {
          return {
            content: [{
              type: "text",
              text: `📵 Call not answered. The user may be away or busy.\n\nYou can try again later or continue working independently.`
            }],
            structuredContent: {
              success: false,
              call_id: callId,
              status: "no_answer",
              error: "User did not answer the call"
            }
          };
        }

        return {
          content: [{
            type: "text",
            text: `❌ Call failed: ${result.error || "Unknown error"}\n\nPlease check if the backend is running.`
          }],
          structuredContent: {
            success: false,
            call_id: callId,
            status: result.status,
            error: result.error || "Call failed"
          }
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        console.error("[call_user] Error:", errorMessage);

        return {
          content: [{
            type: "text",
            text: `❌ Failed to initiate call: ${errorMessage}\n\nMake sure the cc-caller backend is running and accessible.`
          }],
          structuredContent: {
            success: false,
            call_id: callId,
            status: "error",
            error: errorMessage
          }
        };
      }
    }
  );

  mcpServer.registerTool(
    "send_message_in_call",
    {
      title: "Send Message in Active Call",
      description: "Send an additional spoken message during an active call.",
      inputSchema: SendMessageInputSchema
    },
    async (params: SendMessageInput) => {
      try {
        await localCallerService.sendTextMessage(params.call_id, params.message);
        return {
          content: [{ type: "text", text: `📤 Message sent to user in call ${params.call_id}` }],
          structuredContent: { success: true, call_id: params.call_id, message_sent: true }
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        return {
          content: [{ type: "text", text: `❌ Failed to send message: ${errorMessage}` }],
          structuredContent: { success: false, call_id: params.call_id, error: errorMessage }
        };
      }
    }
  );

  mcpServer.registerTool(
    "wait_for_reply",
    {
      title: "Wait for User Reply",
      description: "Wait for the user to respond in an active call.",
      inputSchema: WaitForReplyInputSchema
    },
    async (params: WaitForReplyInput) => {
      try {
        console.log(`[wait_for_reply] Waiting ${params.timeout_seconds}s for response on call ${params.call_id}`);
        const response = await localCallerService.waitForResponse(params.call_id, params.timeout_seconds * 1000);
        if (response) {
          return {
            content: [{ type: "text", text: `🎤 User response received:\n\n"${response.userMessage}"` }],
            structuredContent: {
              success: true,
              call_id: params.call_id,
              user_response: response.userMessage,
              received_at: response.timestamp
            }
          };
        }

        return {
          content: [{
            type: "text",
            text: `⏱️ No response received within ${params.timeout_seconds} seconds.\n\nThe user may be thinking or away. You can wait again or proceed with your best judgment.`
          }],
          structuredContent: {
            success: false,
            call_id: params.call_id,
            timeout: true,
            waited_seconds: params.timeout_seconds
          }
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        return {
          content: [{ type: "text", text: `❌ Error waiting for reply: ${errorMessage}` }],
          structuredContent: { success: false, call_id: params.call_id, error: errorMessage }
        };
      }
    }
  );

  mcpServer.registerTool(
    "end_call",
    {
      title: "End Call",
      description: "End an active call with the user.",
      inputSchema: EndCallInputSchema
    },
    async (params: EndCallInput) => {
      try {
        if (params.farewell_message) {
          await localCallerService.sendTextMessage(params.call_id, params.farewell_message);
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }

        return {
          content: [{
            type: "text",
            text: `📞 Call ${params.call_id} ended.${params.farewell_message ? "\n\nFarewell message delivered." : ""}`
          }],
          structuredContent: { success: true, call_id: params.call_id, ended: true }
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        return {
          content: [{ type: "text", text: `❌ Error ending call: ${errorMessage}` }],
          structuredContent: { success: false, call_id: params.call_id, error: errorMessage }
        };
      }
    }
  );
}

registerMcpTools();

const sseTransports: Record<string, SSEServerTransport> = {};

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

// MCP SSE endpoint
app.get("/mcp/sse", async (req, res) => {
  try {
    // Base path is absolute for clients; session is tracked server-side via query parameter on /mcp/messages.
    const transport = new SSEServerTransport("/mcp/messages", res);
    sseTransports[transport.sessionId] = transport;

    res.on("close", () => {
      delete sseTransports[transport.sessionId];
      transport.close();
    });

    await mcpServer.connect(transport);
  } catch (error) {
    console.error("[MCP] Failed to establish SSE connection:", error);
    res.status(500).end();
  }
});

// MCP client-to-server messages (JSON-RPC POST)
app.post("/mcp/messages", async (req, res) => {
  const sessionIdRaw = req.query.sessionId;
  const sessionId = typeof sessionIdRaw === "string" ? sessionIdRaw : undefined;
  if (!sessionId) {
    res.status(400).json({ error: "Missing sessionId" });
    return;
  }

  const transport = sseTransports[sessionId];
  if (!transport) {
    res.status(400).json({ error: "No transport found for sessionId" });
    return;
  }

  try {
    await transport.handlePostMessage(req, res, req.body);
  } catch (error) {
    console.error("[MCP] Failed to handle POST message:", error);
    res.status(500).json({ error: "Failed to handle message" });
  }
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
║    GET /mcp/sse - MCP over SSE (Claude App)                ║
║    POST /mcp/messages?sessionId=...                        ║
║                                                            ║
║  Waiting for connections...                                ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
  `);
});
