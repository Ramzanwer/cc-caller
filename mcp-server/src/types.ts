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

// Urgency levels for calls
export enum UrgencyLevel {
  LOW = "low",           // Just an update, no rush
  NORMAL = "normal",     // Standard priority
  HIGH = "high",         // Important, needs attention
  CRITICAL = "critical"  // Urgent, immediate attention needed
}

// Call request interface
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

// Call result
export interface CallResult {
  callId: string;
  status: CallStatus;
  duration?: number;
  userResponse?: string;
  error?: string;
}

// Message types for WebSocket communication
export enum MessageType {
  INITIATE_CALL = "initiate_call",
  CALL_STATUS = "call_status",
  USER_RESPONSE = "user_response",
  SEND_MESSAGE = "send_message",
  HEARTBEAT = "heartbeat",
  REGISTER = "register"
}

// WebSocket message structure
export interface WSMessage {
  type: MessageType;
  payload: CallRequest | CallResponse | CallResult | { userId?: string };
  timestamp: number;
}

// Configuration
export interface CallerConfig {
  backendUrl: string;
  wsUrl: string;
  timeout: number;
  retryAttempts: number;
}
