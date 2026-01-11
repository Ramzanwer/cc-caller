import React from 'react';

interface IdleViewProps {
  isConnected: boolean;
  onEnableNotifications: () => void;
  notificationsStatus: 'unknown' | 'enabled' | 'denied' | 'unsupported' | 'error';
  notificationsMessage?: string;
}

export const IdleView: React.FC<IdleViewProps> = ({
  isConnected,
  onEnableNotifications,
  notificationsStatus,
  notificationsMessage
}) => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      {/* Logo */}
      <div className="relative w-40 h-40 mb-8">
        <div className={`absolute inset-0 rounded-full ${isConnected ? 'bg-violet-500/20' : 'bg-gray-500/20'} animate-pulse`}></div>
        <div className={`absolute inset-4 rounded-full ${isConnected ? 'bg-gradient-to-br from-violet-500 to-purple-600' : 'bg-gradient-to-br from-gray-500 to-gray-600'} flex items-center justify-center shadow-xl`}>
          <span className="text-6xl">📞</span>
        </div>
      </div>

      {/* Title */}
      <h1 className="text-4xl font-bold text-white mb-4 text-center">
        cc-caller
      </h1>
      
      <p className="text-violet-200 text-center mb-8 max-w-md">
        Receive voice calls from Claude Code when it needs your help or wants to report progress.
      </p>

      {/* Connection Status */}
      <div className={`flex items-center gap-3 px-6 py-3 rounded-full ${
        isConnected 
          ? 'bg-green-500/20 border border-green-400/30' 
          : 'bg-red-500/20 border border-red-400/30'
      }`}>
        <div className={`w-3 h-3 rounded-full ${
          isConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'
        }`}></div>
        <span className={isConnected ? 'text-green-300' : 'text-red-300'}>
          {isConnected ? 'Connected - Waiting for calls' : 'Connecting to server...'}
        </span>
      </div>

      {/* Push Notifications */}
      <div className="mt-6 flex flex-col items-center gap-3">
        <button
          onClick={onEnableNotifications}
          disabled={notificationsStatus === 'enabled' || notificationsStatus === 'denied' || notificationsStatus === 'unsupported'}
          className="bg-violet-600/50 hover:bg-violet-500/50 disabled:bg-violet-900/40 disabled:cursor-not-allowed border border-violet-400/30 text-violet-100 px-6 py-3 rounded-xl transition-all"
        >
          {notificationsStatus === 'enabled'
            ? 'Notifications enabled'
            : notificationsStatus === 'denied'
              ? 'Notifications blocked'
              : notificationsStatus === 'unsupported'
                ? 'Notifications unsupported'
                : 'Enable notifications'}
        </button>
        {notificationsMessage && (
          <p className="text-violet-200/80 text-sm text-center max-w-md">
            {notificationsMessage}
          </p>
        )}
      </div>

      {/* Instructions */}
      <div className="mt-12 bg-black/30 rounded-2xl p-6 max-w-lg">
        <h3 className="text-violet-100 font-semibold mb-4 flex items-center gap-2">
          <span>💡</span> How it works
        </h3>
        <ul className="space-y-3 text-violet-200/80 text-sm">
          <li className="flex items-start gap-3">
            <span className="text-violet-400">1.</span>
            <span>Keep this page open while Claude Code is working</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-violet-400">2.</span>
            <span>When Claude needs help or finishes a task, you'll receive a call</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-violet-400">3.</span>
            <span>Answer the call to hear Claude's message and respond</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-violet-400">4.</span>
            <span>Use voice or text to give Claude instructions</span>
          </li>
        </ul>
      </div>

      {/* Footer */}
      <p className="text-violet-400/50 text-xs mt-8">
        Make sure to allow microphone access for voice responses
      </p>
    </div>
  );
};
