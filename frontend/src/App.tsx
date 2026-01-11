import React, { useState } from 'react';
import { useWebSocket, IncomingCall } from './hooks/useWebSocket';
import { IncomingCallModal } from './components/IncomingCallModal';
import { ActiveCallView } from './components/ActiveCallView';
import { IdleView } from './components/IdleView';

function getDefaultWebSocketUrl(): string {
  if (import.meta.env.DEV) return 'ws://localhost:3001';
  if (typeof window === 'undefined') return 'ws://localhost:3001';

  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${protocol}://${window.location.host}`;
}

// Get WebSocket URL from environment or infer from the current origin in production
const WS_URL = import.meta.env.VITE_WS_URL || getDefaultWebSocketUrl();

type CallState = 'idle' | 'ringing' | 'active';

function App() {
  const [callState, setCallState] = useState<CallState>('idle');
  const [activeCall, setActiveCall] = useState<IncomingCall | null>(null);

  const {
    isConnected,
    incomingCall,
    ttsMessage,
    acceptCall,
    rejectCall,
    sendResponse,
    clearTTSMessage
  } = useWebSocket(WS_URL);

  // Handle incoming call
  React.useEffect(() => {
    if (incomingCall && callState === 'idle') {
      setCallState('ringing');
    }
  }, [incomingCall, callState]);

  // Handle accept call
  const handleAcceptCall = () => {
    if (incomingCall) {
      acceptCall(incomingCall.callId);
      setActiveCall(incomingCall);
      setCallState('active');
    }
  };

  // Handle reject call
  const handleRejectCall = () => {
    if (incomingCall) {
      rejectCall(incomingCall.callId);
      setCallState('idle');
    }
  };

  // Handle send response
  const handleSendResponse = (message: string) => {
    if (activeCall) {
      sendResponse(activeCall.callId, message);
      setActiveCall(null);
      setCallState('idle');
    }
  };

  return (
    <div className="min-h-screen">
      {/* Idle state - waiting for calls */}
      {callState === 'idle' && (
        <IdleView isConnected={isConnected} />
      )}

      {/* Ringing state - incoming call modal */}
      {callState === 'ringing' && incomingCall && (
        <>
          <IdleView isConnected={isConnected} />
          <IncomingCallModal
            call={incomingCall}
            onAccept={handleAcceptCall}
            onReject={handleRejectCall}
          />
        </>
      )}

      {/* Active call state */}
      {callState === 'active' && activeCall && (
        <ActiveCallView
          call={activeCall}
          ttsMessage={ttsMessage}
          onSendResponse={handleSendResponse}
          onClearTTS={clearTTSMessage}
        />
      )}
    </div>
  );
}

export default App;
