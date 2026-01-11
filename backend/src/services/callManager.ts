import { WebSocket } from "ws";
import {
  ActiveCall,
  CallRequest,
  CallStatus,
  ClientConnection,
  MessageType,
  WSMessage
} from "../types.js";
import { sendPushNotification } from "./pushService.js";

export class CallManager {
  private activeCalls: Map<string, ActiveCall> = new Map();
  private clients: Map<WebSocket, ClientConnection> = new Map();
  private claudeClient: WebSocket | null = null;
  private userClients: Set<WebSocket> = new Set();

  // Register a new client connection
  registerClient(ws: WebSocket, clientType: "claude" | "user", userId?: string): void {
    const connection: ClientConnection = {
      ws,
      clientType,
      userId,
      connectedAt: Date.now(),
      lastHeartbeat: Date.now()
    };

    this.clients.set(ws, connection);

    if (clientType === "claude") {
      this.claudeClient = ws;
      console.log("[CallManager] Claude client registered");
    } else {
      this.userClients.add(ws);
      console.log(`[CallManager] User client registered: ${userId || "anonymous"}`);

      // If there is a ringing call, notify the newly connected user client.
      for (const call of this.activeCalls.values()) {
        if (call.status !== CallStatus.RINGING) continue;
        this.sendToUser(ws, {
          type: MessageType.INCOMING_CALL,
          payload: {
            callId: call.callId,
            message: call.request.message,
            urgency: call.request.urgency,
            context: call.request.context
          },
          timestamp: Date.now()
        });
      }
    }
  }

  // Remove a client connection
  removeClient(ws: WebSocket): void {
    const client = this.clients.get(ws);
    if (client) {
      if (client.clientType === "claude") {
        this.claudeClient = null;
        console.log("[CallManager] Claude client disconnected");
      } else {
        this.userClients.delete(ws);
        console.log("[CallManager] User client disconnected");
      }
      this.clients.delete(ws);
    }
  }

  // Initiate a new call
  initiateCall(request: CallRequest): void {
    console.log(`[CallManager] Initiating call ${request.callId}`);

    const call: ActiveCall = {
      callId: request.callId,
      request,
      status: CallStatus.PENDING,
      startTime: Date.now()
    };

    this.activeCalls.set(request.callId, call);

    call.status = CallStatus.RINGING;

    // Send incoming call notification to all user clients
    const incomingCallMessage: WSMessage = {
      type: MessageType.INCOMING_CALL,
      payload: {
        callId: request.callId,
        message: request.message,
        urgency: request.urgency,
        context: request.context
      },
      timestamp: Date.now()
    };

    // Always attempt a Web Push notification (SW can suppress when app is foregrounded).
    void sendPushNotification({
      type: "incoming_call",
      title: "Incoming call",
      body: request.message,
      callId: request.callId,
      urgency: request.urgency,
      url: "/"
    });

    if (this.userClients.size === 0) {
      console.log("[CallManager] No user clients connected (will rely on Web Push)");
    } else {
      this.broadcastToUsers(incomingCallMessage);
    }

    // Set timeout for no answer
    setTimeout(() => {
      const call = this.activeCalls.get(request.callId);
      if (call && call.status === CallStatus.RINGING) {
        this.updateCallStatus(request.callId, CallStatus.NO_ANSWER);
      }
    }, 60000); // 1 minute timeout
  }

  // User accepts the call
  acceptCall(callId: string): void {
    const call = this.activeCalls.get(callId);
    if (!call) {
      console.log(`[CallManager] Call ${callId} not found`);
      return;
    }

    call.status = CallStatus.CONNECTED;
    call.connectedTime = Date.now();

    console.log(`[CallManager] Call ${callId} accepted`);

    // Notify Claude that call is connected
    this.sendToClaudeClient({
      type: MessageType.CALL_STATUS,
      payload: {
        callId,
        status: CallStatus.CONNECTED
      },
      timestamp: Date.now()
    });
  }

  // User rejects the call
  rejectCall(callId: string): void {
    this.updateCallStatus(callId, CallStatus.FAILED, "Call rejected by user");
  }

  // User sends a response
  handleUserResponse(callId: string, userMessage: string): void {
    const call = this.activeCalls.get(callId);
    if (!call) {
      console.log(`[CallManager] Call ${callId} not found for response`);
      return;
    }

    call.userResponse = userMessage;
    call.status = CallStatus.COMPLETED;
    call.endTime = Date.now();

    console.log(`[CallManager] User response for call ${callId}: "${userMessage}"`);

    // Send response to Claude
    this.sendToClaudeClient({
      type: MessageType.USER_RESPONSE,
      payload: {
        callId,
        userMessage,
        timestamp: Date.now()
      },
      timestamp: Date.now()
    });

    // Also send completed status
    this.sendToClaudeClient({
      type: MessageType.CALL_STATUS,
      payload: {
        callId,
        status: CallStatus.COMPLETED,
        userResponse: userMessage,
        duration: call.endTime - call.startTime
      },
      timestamp: Date.now()
    });
  }

  // Send additional message during call
  sendMessageInCall(callId: string, message: string): void {
    const call = this.activeCalls.get(callId);
    if (!call || call.status !== CallStatus.CONNECTED) {
      console.log(`[CallManager] Cannot send message - call ${callId} not active`);
      return;
    }

    // Always attempt a Web Push notification (SW can suppress when app is foregrounded).
    void sendPushNotification({
      type: "tts_message",
      title: "New message",
      body: message,
      callId,
      url: "/"
    });

    // Send TTS message to user clients
    this.broadcastToUsers({
      type: MessageType.TTS_MESSAGE,
      payload: {
        callId,
        message
      },
      timestamp: Date.now()
    });
  }

  // Update call status
  private updateCallStatus(callId: string, status: CallStatus, error?: string): void {
    const call = this.activeCalls.get(callId);
    if (!call) return;

    call.status = status;
    if (status === CallStatus.COMPLETED || status === CallStatus.FAILED || status === CallStatus.NO_ANSWER) {
      call.endTime = Date.now();
    }

    console.log(`[CallManager] Call ${callId} status updated to ${status}`);

    // Notify Claude
    this.sendToClaudeClient({
      type: MessageType.CALL_STATUS,
      payload: {
        callId,
        status,
        error,
        duration: call.endTime ? call.endTime - call.startTime : undefined,
        userResponse: call.userResponse
      },
      timestamp: Date.now()
    });
  }

  // Send message to Claude client
  private sendToClaudeClient(message: WSMessage): void {
    if (this.claudeClient && this.claudeClient.readyState === WebSocket.OPEN) {
      this.claudeClient.send(JSON.stringify(message));
    }
  }

  // Broadcast to all user clients
  private broadcastToUsers(message: WSMessage): void {
    const messageStr = JSON.stringify(message);
    for (const client of this.userClients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(messageStr);
      }
    }
  }

  private sendToUser(ws: WebSocket, message: WSMessage): void {
    if (ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify(message));
  }

  // Get call by ID
  getCall(callId: string): ActiveCall | undefined {
    return this.activeCalls.get(callId);
  }

  // Get stats
  getStats(): { activeCalls: number; connectedUsers: number; claudeConnected: boolean } {
    return {
      activeCalls: this.activeCalls.size,
      connectedUsers: this.userClients.size,
      claudeConnected: this.claudeClient !== null && this.claudeClient.readyState === WebSocket.OPEN
    };
  }

  // Update heartbeat
  updateHeartbeat(ws: WebSocket): void {
    const client = this.clients.get(ws);
    if (client) {
      client.lastHeartbeat = Date.now();
    }
  }
}

// Singleton instance
export const callManager = new CallManager();
