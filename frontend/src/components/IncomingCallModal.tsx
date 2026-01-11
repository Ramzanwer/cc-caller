import React, { useEffect, useRef } from 'react';
import { IncomingCall, UrgencyLevel } from '../hooks/useWebSocket';

interface IncomingCallModalProps {
  call: IncomingCall;
  onAccept: () => void;
  onReject: () => void;
}

const urgencyConfig: Record<UrgencyLevel, { color: string; label: string; emoji: string }> = {
  [UrgencyLevel.LOW]: { color: 'bg-blue-500', label: 'Low Priority', emoji: '💡' },
  [UrgencyLevel.NORMAL]: { color: 'bg-green-500', label: 'Normal', emoji: '📞' },
  [UrgencyLevel.HIGH]: { color: 'bg-orange-500', label: 'Important', emoji: '⚠️' },
  [UrgencyLevel.CRITICAL]: { color: 'bg-red-500', label: 'URGENT', emoji: '🚨' }
};

export const IncomingCallModal: React.FC<IncomingCallModalProps> = ({
  call,
  onAccept,
  onReject
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const config = urgencyConfig[call.urgency] || urgencyConfig[UrgencyLevel.NORMAL];

  useEffect(() => {
    // Play ringtone
    const playRingtone = async () => {
      try {
        // Create a simple beep using Web Audio API
        const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        
        const playBeep = () => {
          const oscillator = audioContext.createOscillator();
          const gainNode = audioContext.createGain();
          
          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);
          
          oscillator.frequency.value = call.urgency === UrgencyLevel.CRITICAL ? 880 : 660;
          oscillator.type = 'sine';
          
          gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
          
          oscillator.start(audioContext.currentTime);
          oscillator.stop(audioContext.currentTime + 0.5);
        };

        // Play beep pattern
        const interval = setInterval(playBeep, 1000);
        
        return () => {
          clearInterval(interval);
          audioContext.close();
        };
      } catch (error) {
        console.error('Audio playback error:', error);
      }
    };

    const cleanup = playRingtone();
    return () => {
      cleanup?.then(fn => fn?.());
    };
  }, [call.urgency]);

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-indigo-900 to-purple-900 rounded-3xl shadow-2xl p-8 max-w-md w-full animate-glow">
        {/* Urgency Badge */}
        <div className="flex justify-center mb-6">
          <span className={`${config.color} text-white px-4 py-1 rounded-full text-sm font-semibold flex items-center gap-2`}>
            {config.emoji} {config.label}
          </span>
        </div>

        {/* Claude Avatar */}
        <div className="relative mx-auto w-32 h-32 mb-6">
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-violet-400 to-purple-500 animate-pulse-ring"></div>
          <div className="absolute inset-2 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
            <span className="text-5xl animate-ring">📞</span>
          </div>
        </div>

        {/* Caller Info */}
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-white mb-2">Claude Code is calling...</h2>
          <p className="text-violet-200 text-sm">Incoming voice call</p>
        </div>

        {/* Message Preview */}
        <div className="bg-black/30 rounded-xl p-4 mb-6">
          <p className="text-violet-100 text-center line-clamp-3">
            "{call.message}"
          </p>
          {call.context && (
            <p className="text-violet-300/70 text-sm text-center mt-2 italic">
              Context: {call.context}
            </p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4">
          <button
            onClick={onReject}
            className="flex-1 bg-red-500/20 hover:bg-red-500/40 border border-red-400/30 text-red-300 font-semibold py-4 px-6 rounded-xl transition-all flex items-center justify-center gap-2"
          >
            <span className="text-2xl">❌</span>
            <span>Decline</span>
          </button>
          <button
            onClick={onAccept}
            className="flex-1 bg-green-500/20 hover:bg-green-500/40 border border-green-400/30 text-green-300 font-semibold py-4 px-6 rounded-xl transition-all flex items-center justify-center gap-2"
          >
            <span className="text-2xl">✅</span>
            <span>Answer</span>
          </button>
        </div>
      </div>
    </div>
  );
};
