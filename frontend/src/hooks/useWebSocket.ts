import { useState, useEffect, useCallback, useRef } from 'react';

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

export enum UrgencyLevel {
  LOW = "low",
  NORMAL = "normal",
  HIGH = "high",
  CRITICAL = "critical"
}

export interface IncomingCall {
  callId: string;
  message: string;
  urgency: UrgencyLevel;
  context?: string;
}

export interface WSMessage {
  type: MessageType;
  payload: Record<string, unknown>;
  timestamp: number;
}

interface UseWebSocketReturn {
  isConnected: boolean;
  incomingCall: IncomingCall | null;
  ttsMessage: string | null;
  acceptCall: (callId: string) => void;
  rejectCall: (callId: string) => void;
  sendResponse: (callId: string, message: string) => void;
  clearTTSMessage: () => void;
}

export function useWebSocket(url: string): UseWebSocketReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [ttsMessage, setTtsMessage] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    console.log('[WebSocket] Connecting to', url);
    const ws = new WebSocket(url);

    ws.onopen = () => {
      console.log('[WebSocket] Connected');
      setIsConnected(true);
      
      // Register as user client
      ws.send(JSON.stringify({
        type: MessageType.REGISTER,
        payload: { userId: `user-${Date.now()}` },
        timestamp: Date.now()
      }));
    };

    ws.onmessage = (event) => {
      try {
        const message: WSMessage = JSON.parse(event.data);
        console.log('[WebSocket] Received:', message.type);

        switch (message.type) {
          case MessageType.INCOMING_CALL:
            setIncomingCall(message.payload as IncomingCall);
            break;
          
          case MessageType.TTS_MESSAGE:
            setTtsMessage((message.payload as { message: string }).message);
            break;

          case MessageType.CALL_ENDED:
            setIncomingCall(null);
            break;
        }
      } catch (error) {
        console.error('[WebSocket] Parse error:', error);
      }
    };

    ws.onclose = () => {
      console.log('[WebSocket] Disconnected');
      setIsConnected(false);
      wsRef.current = null;

      // Attempt reconnect after 3 seconds
      reconnectTimeoutRef.current = window.setTimeout(() => {
        connect();
      }, 3000);
    };

    ws.onerror = (error) => {
      console.error('[WebSocket] Error:', error);
    };

    wsRef.current = ws;
  }, [url]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  const sendMessage = useCallback((type: MessageType, payload: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type,
        payload,
        timestamp: Date.now()
      }));
    }
  }, []);

  const acceptCall = useCallback((callId: string) => {
    sendMessage(MessageType.CALL_ACCEPTED, { callId });
  }, [sendMessage]);

  const rejectCall = useCallback((callId: string) => {
    sendMessage(MessageType.CALL_REJECTED, { callId });
    setIncomingCall(null);
  }, [sendMessage]);

  const sendResponse = useCallback((callId: string, message: string) => {
    sendMessage(MessageType.USER_RESPONSE, { callId, userMessage: message });
    setIncomingCall(null);
  }, [sendMessage]);

  const clearTTSMessage = useCallback(() => {
    setTtsMessage(null);
  }, []);

  return {
    isConnected,
    incomingCall,
    ttsMessage,
    acceptCall,
    rejectCall,
    sendResponse,
    clearTTSMessage
  };
}
