import WebSocket from "ws";
import {
  WSMessage,
  MessageType,
  CallRequest,
  CallResult,
  CallStatus,
  CallResponse
} from "../types.js";

type CallbackFn = (result: CallResult) => void;
type ResponseCallbackFn = (response: CallResponse) => void;

export class CallerService {
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
          console.error("[CallerService] Connected to backend");
          this.reconnectAttempts = 0;
          this.isConnecting = false;
          
          // Register as Claude Code client
          this.sendMessage({
            type: MessageType.REGISTER,
            payload: { userId: "claude-code" },
            timestamp: Date.now()
          });
          
          resolve();
        });

        this.ws.on("message", (data) => {
          try {
            const message: WSMessage = JSON.parse(data.toString());
            this.handleMessage(message);
          } catch (error) {
            console.error("[CallerService] Failed to parse message:", error);
          }
        });

        this.ws.on("close", () => {
          console.error("[CallerService] Connection closed");
          this.isConnecting = false;
          this.attemptReconnect();
        });

        this.ws.on("error", (error) => {
          console.error("[CallerService] WebSocket error:", error.message);
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
      console.error("[CallerService] Max reconnection attempts reached");
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    
    console.error(`[CallerService] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    setTimeout(() => {
      this.connect().catch(console.error);
    }, delay);
  }

  private handleMessage(message: WSMessage): void {
    switch (message.type) {
      case MessageType.CALL_STATUS: {
        const result = message.payload as CallResult;
        const callback = this.callCallbacks.get(result.callId);
        if (callback) {
          callback(result);
          if (result.status === CallStatus.COMPLETED || 
              result.status === CallStatus.FAILED ||
              result.status === CallStatus.NO_ANSWER) {
            this.callCallbacks.delete(result.callId);
          }
        }
        break;
      }

      case MessageType.USER_RESPONSE: {
        const response = message.payload as CallResponse;
        const callback = this.responseCallbacks.get(response.callId);
        if (callback) {
          callback(response);
          this.responseCallbacks.delete(response.callId);
        }
        break;
      }

      case MessageType.HEARTBEAT:
        // Respond to heartbeat
        this.sendMessage({
          type: MessageType.HEARTBEAT,
          payload: {},
          timestamp: Date.now()
        });
        break;

      default:
        console.error("[CallerService] Unknown message type:", message.type);
    }
  }

  private sendMessage(message: WSMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.error("[CallerService] WebSocket not connected");
    }
  }

  async initiateCall(request: CallRequest): Promise<CallResult> {
    await this.connect();

    return new Promise((resolve, reject) => {
      // Set up callback for call status updates
      this.callCallbacks.set(request.callId, (result) => {
        if (result.status === CallStatus.COMPLETED ||
            result.status === CallStatus.FAILED ||
            result.status === CallStatus.NO_ANSWER) {
          resolve(result);
        }
      });

      // Send call request
      this.sendMessage({
        type: MessageType.INITIATE_CALL,
        payload: request,
        timestamp: Date.now()
      });

      // Set timeout
      setTimeout(() => {
        if (this.callCallbacks.has(request.callId)) {
          this.callCallbacks.delete(request.callId);
          resolve({
            callId: request.callId,
            status: CallStatus.NO_ANSWER,
            error: "Call timed out - no answer from user"
          });
        }
      }, 120000); // 2 minute timeout
    });
  }

  async waitForResponse(callId: string, timeoutMs: number = 60000): Promise<CallResponse | null> {
    await this.connect();

    return new Promise((resolve) => {
      this.responseCallbacks.set(callId, (response) => {
        resolve(response);
      });

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
      } as unknown as CallRequest,
      timestamp: Date.now()
    });
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

// Singleton instance
let callerServiceInstance: CallerService | null = null;

export function getCallerService(wsUrl?: string): CallerService {
  if (!callerServiceInstance) {
    const url = wsUrl || process.env.CALLER_WS_URL || "ws://localhost:3001";
    callerServiceInstance = new CallerService(url);
  }
  return callerServiceInstance;
}
