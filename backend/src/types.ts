import type { WebSocket } from "ws";

// Call status types
export enum CallStatus {
  PENDING = "pending",
  RINGING = "ringing",
  CONNECTED = "connected",
  COMPLETED = "completed",
  FAILED = "failed",
  NO_ANSWER = "no_answer",
  BUSY = "busy"
}

// Urgency levels
export enum UrgencyLevel {
  LOW = "low",
  NORMAL = "normal",
  HIGH = "high",
  CRITICAL = "critical"
}

// Message types
export enum MessageType {
  INITIATE_CALL = "initiate_call",
  CALL_STATUS = "call_status",
  USER_RESPONSE = "user_response",
  SEND_MESSAGE = "send_message",
  HEARTBEAT = "heartbeat",
  REGISTER = "register",
  INCOMING_CALL = "incoming_call",
  CALL_ACCEPTED = "call_accepted",
  CALL_REJECTED = "call_rejected",
  CALL_ENDED = "call_ended",
  TTS_MESSAGE = "tts_message"
}

// Call request from Claude
export interface CallRequest {
  callId: string;
  message: string;
  urgency: UrgencyLevel;
  context?: string;
  requiresResponse: boolean;
  timestamp: number;
}

// Call response from user
export interface CallResponse {
  callId: string;
  userMessage: string;
  timestamp: number;
}

// Active call state
export interface ActiveCall {
  callId: string;
  request: CallRequest;
  status: CallStatus;
  startTime: number;
  connectedTime?: number;
  endTime?: number;
  userResponse?: string;
}

// Client connection
export interface ClientConnection {
  ws: WebSocket;
  clientType: "claude" | "user";
  userId?: string;
  connectedAt: number;
  lastHeartbeat: number;
}

// WebSocket message
export interface WSMessage {
  type: MessageType;
  payload: Record<string, unknown>;
  timestamp: number;
}
