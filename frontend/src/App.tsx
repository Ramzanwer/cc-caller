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

function wsToHttpBase(wsUrl: string): string {
  const u = new URL(wsUrl);
  u.protocol = u.protocol === 'wss:' ? 'https:' : 'http:';
  u.pathname = '';
  u.search = '';
  u.hash = '';
  return u.toString().replace(/\/$/, '');
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

type NotificationsStatus = 'unknown' | 'enabled' | 'denied' | 'unsupported' | 'error';

function App() {
  const [callState, setCallState] = useState<CallState>('idle');
  const [activeCall, setActiveCall] = useState<IncomingCall | null>(null);
  const [notificationsStatus, setNotificationsStatus] = useState<NotificationsStatus>('unknown');
  const [notificationsMessage, setNotificationsMessage] = useState<string | undefined>(undefined);

  const {
    isConnected,
    incomingCall,
    ttsMessage,
    acceptCall,
    rejectCall,
    sendResponse,
    clearTTSMessage
  } = useWebSocket(WS_URL);

  const enableNotifications = async () => {
    try {
      setNotificationsMessage(undefined);

      if (!('Notification' in window) || !('serviceWorker' in navigator)) {
        setNotificationsStatus('unsupported');
        setNotificationsMessage('This browser does not support notifications or service workers.');
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setNotificationsStatus('denied');
        setNotificationsMessage('Permission not granted. Please enable notifications in your browser settings.');
        return;
      }

      const apiBase = wsToHttpBase(WS_URL);
      const keyRes = await fetch(`${apiBase}/push/vapid-public-key`);
      if (!keyRes.ok) {
        const err = await keyRes.json().catch(() => ({}));
        setNotificationsStatus('error');
        setNotificationsMessage(
          typeof err?.error === 'string' ? err.error : 'Failed to fetch VAPID public key from server.'
        );
        return;
      }

      const { publicKey } = (await keyRes.json()) as { publicKey: string };
      const registration = await navigator.serviceWorker.ready;

      const existing = await registration.pushManager.getSubscription();
      const subscription =
        existing ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey) as unknown as BufferSource
        }));

      const subRes = await fetch(`${apiBase}/push/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription)
      });
      if (!subRes.ok) {
        setNotificationsStatus('error');
        setNotificationsMessage('Failed to register push subscription with server.');
        return;
      }

      setNotificationsStatus('enabled');
      setNotificationsMessage('Notifications are enabled. You can now receive incoming call alerts.');
    } catch (err) {
      console.error('[Push] Enable notifications failed:', err);
      setNotificationsStatus('error');
      setNotificationsMessage('Failed to enable notifications.');
    }
  };

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
        <IdleView
          isConnected={isConnected}
          onEnableNotifications={enableNotifications}
          notificationsStatus={notificationsStatus}
          notificationsMessage={notificationsMessage}
        />
      )}

      {/* Ringing state - incoming call modal */}
      {callState === 'ringing' && incomingCall && (
        <>
          <IdleView
            isConnected={isConnected}
            onEnableNotifications={enableNotifications}
            notificationsStatus={notificationsStatus}
            notificationsMessage={notificationsMessage}
          />
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
