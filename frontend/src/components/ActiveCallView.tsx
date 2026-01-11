import React, { useState, useEffect } from 'react';
import { IncomingCall } from '../hooks/useWebSocket';
import { useTTS } from '../hooks/useTTS';
import { useSTT } from '../hooks/useSTT';

interface ActiveCallViewProps {
  call: IncomingCall;
  ttsMessage: string | null;
  onSendResponse: (message: string) => void;
  onClearTTS: () => void;
}

export const ActiveCallView: React.FC<ActiveCallViewProps> = ({
  call,
  ttsMessage,
  onSendResponse,
  onClearTTS
}) => {
  const [elapsedTime, setElapsedTime] = useState(0);
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<Array<{ from: 'claude' | 'user'; text: string }>>([]);
  
  const { speak, stop } = useTTS();
  const { isListening, transcript, interimTranscript, startListening, stopListening, resetTranscript, isSupported } = useSTT();

  // Timer
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedTime(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Add initial message
  useEffect(() => {
    setMessages([{ from: 'claude', text: call.message }]);
    speak(call.message);
  }, [call.message, speak]);

  // Handle TTS messages from Claude
  useEffect(() => {
    if (ttsMessage) {
      setMessages(prev => [...prev, { from: 'claude', text: ttsMessage }]);
      speak(ttsMessage);
      onClearTTS();
    }
  }, [ttsMessage, speak, onClearTTS]);

  // Format time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle sending response
  const handleSend = () => {
    const messageToSend = inputText || transcript;
    if (messageToSend.trim()) {
      setMessages(prev => [...prev, { from: 'user', text: messageToSend }]);
      onSendResponse(messageToSend);
      setInputText('');
      resetTranscript();
      stop();
    }
  };

  // Toggle voice recording
  const toggleRecording = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-900/80 to-purple-900/80 backdrop-blur-lg p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
            <span className="text-2xl">🤖</span>
          </div>
          <div>
            <h2 className="text-white font-semibold">Claude Code</h2>
            <p className="text-violet-300 text-sm flex items-center gap-1">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
              Connected • {formatTime(elapsedTime)}
            </p>
          </div>
        </div>
        <button
          onClick={() => onSendResponse('[Call ended by user]')}
          className="bg-red-500/20 hover:bg-red-500/40 border border-red-400/30 text-red-300 px-4 py-2 rounded-lg transition-all"
        >
          End Call
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`flex ${msg.from === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl p-4 ${
                msg.from === 'claude'
                  ? 'bg-indigo-900/60 text-violet-100'
                  : 'bg-purple-600/60 text-white'
              }`}
            >
              <p className="text-sm opacity-60 mb-1">
                {msg.from === 'claude' ? '🤖 Claude' : '👤 You'}
              </p>
              <p>{msg.text}</p>
            </div>
          </div>
        ))}

        {/* Interim transcript */}
        {interimTranscript && (
          <div className="flex justify-end">
            <div className="max-w-[80%] rounded-2xl p-4 bg-purple-600/30 text-purple-200 italic">
              <p className="text-sm opacity-60 mb-1">🎤 Speaking...</p>
              <p>{interimTranscript}</p>
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="bg-gradient-to-r from-indigo-900/80 to-purple-900/80 backdrop-blur-lg p-4">
        {/* Voice transcript display */}
        {transcript && (
          <div className="bg-black/30 rounded-lg p-3 mb-3">
            <p className="text-violet-200 text-sm">{transcript}</p>
          </div>
        )}

        <div className="flex gap-3">
          {/* Text input */}
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type or use voice..."
            className="flex-1 bg-black/30 border border-violet-500/30 rounded-xl px-4 py-3 text-white placeholder-violet-400/50 focus:outline-none focus:border-violet-400"
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          />

          {/* Voice button */}
          {isSupported && (
            <button
              onClick={toggleRecording}
              className={`w-14 h-14 rounded-xl flex items-center justify-center transition-all ${
                isListening
                  ? 'bg-red-500 text-white animate-pulse'
                  : 'bg-violet-600/50 text-violet-200 hover:bg-violet-500/50'
              }`}
            >
              <span className="text-2xl">{isListening ? '⏹️' : '🎤'}</span>
            </button>
          )}

          {/* Send button */}
          <button
            onClick={handleSend}
            disabled={!inputText && !transcript}
            className="w-14 h-14 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:bg-violet-900/50 disabled:cursor-not-allowed text-white flex items-center justify-center transition-all"
          >
            <span className="text-2xl">📤</span>
          </button>
        </div>

        {!isSupported && (
          <p className="text-violet-400/60 text-xs mt-2 text-center">
            Voice input not supported in this browser
          </p>
        )}
      </div>
    </div>
  );
};
