import { useCallback, useEffect, useRef } from 'react';

interface UseTTSReturn {
  speak: (text: string) => void;
  stop: () => void;
  isSpeaking: boolean;
}

export function useTTS(): UseTTSReturn {
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const isSpeakingRef = useRef(false);

  useEffect(() => {
    synthRef.current = window.speechSynthesis;
  }, []);

  const speak = useCallback((text: string) => {
    if (!synthRef.current) return;

    // Cancel any ongoing speech
    synthRef.current.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    
    // Configure voice
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    // Try to get a good English voice
    const voices = synthRef.current.getVoices();
    const preferredVoice = voices.find(
      v => v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Alex')
    ) || voices.find(v => v.lang.startsWith('en'));
    
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    utterance.onstart = () => {
      isSpeakingRef.current = true;
    };

    utterance.onend = () => {
      isSpeakingRef.current = false;
    };

    utterance.onerror = () => {
      isSpeakingRef.current = false;
    };

    synthRef.current.speak(utterance);
  }, []);

  const stop = useCallback(() => {
    if (synthRef.current) {
      synthRef.current.cancel();
      isSpeakingRef.current = false;
    }
  }, []);

  return {
    speak,
    stop,
    isSpeaking: isSpeakingRef.current
  };
}
