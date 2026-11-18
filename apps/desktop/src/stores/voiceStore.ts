import { create } from 'zustand';

export type VADSensitivity = 'low' | 'medium' | 'high';
export type VADStatus = 'idle' | 'listening' | 'speech_active' | 'silence_counting' | 'processing';

export interface VoiceSettings {
  smartListeningEnabled: boolean;
  silenceTimeoutMs: number;
  vadSensitivity: VADSensitivity;
  conversationalMode: boolean;
  ttsProvider: string;
  activeVoiceId: string;
  speed: number;
  wakeWordEnabled: boolean;
  wakeWord: string;
}

const STORAGE_KEY = 'nero_voice_settings_v1';

function loadSavedVoiceSettings(): VoiceSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        smartListeningEnabled: parsed.smartListeningEnabled ?? true,
        silenceTimeoutMs: typeof parsed.silenceTimeoutMs === 'number' ? parsed.silenceTimeoutMs : 1200,
        vadSensitivity: parsed.vadSensitivity || 'medium',
        conversationalMode: parsed.conversationalMode ?? false,
        ttsProvider: parsed.ttsProvider || 'fish_audio',
        activeVoiceId: parsed.activeVoiceId || '54f224d5500e482390f77977a41496d0',
        speed: typeof parsed.speed === 'number' ? parsed.speed : 1.0,
        wakeWordEnabled: parsed.wakeWordEnabled ?? false,
        wakeWord: parsed.wakeWord || 'nero',
      };
    }
  } catch {
    // Fall back to defaults
  }
  return {
    smartListeningEnabled: true,
    silenceTimeoutMs: 1200,
    vadSensitivity: 'medium',
    conversationalMode: false,
    ttsProvider: 'fish_audio',
    activeVoiceId: '54f224d5500e482390f77977a41496d0',
    speed: 1.0,
    wakeWordEnabled: false,
    wakeWord: 'nero',
  };
}

function saveVoiceSettings(settings: VoiceSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage errors
  }
}

export interface VoiceState extends VoiceSettings {
  isRecording: boolean;
  isProcessing: boolean;
  isSpeaking: boolean;
  transcribedText: string;
  audioLevel: number;
  lastSpokenText: string;

  // Real-time VAD states
  isSpeechDetected: boolean;
  silenceProgress: number; // 0.0 to 1.0 (countdown to auto-stop)
  vadStatus: VADStatus;

  setIsRecording: (isRecording: boolean) => void;
  setIsProcessing: (isProcessing: boolean) => void;
  setIsSpeaking: (isSpeaking: boolean) => void;
  setTtsProvider: (ttsProvider: string) => void;
  setActiveVoiceId: (activeVoiceId: string) => void;
  setWakeWordEnabled: (wakeWordEnabled: boolean) => void;
  setWakeWord: (wakeWord: string) => void;
  setTranscribedText: (text: string) => void;
  setAudioLevel: (level: number) => void;
  setLastSpokenText: (text: string) => void;
  setSpeed: (speed: number) => void;

  // Smart Voice & VAD actions
  setSmartListeningEnabled: (enabled: boolean) => void;
  setSilenceTimeoutMs: (ms: number) => void;
  setVadSensitivity: (sens: VADSensitivity) => void;
  setConversationalMode: (enabled: boolean) => void;
  setIsSpeechDetected: (detected: boolean) => void;
  setSilenceProgress: (progress: number) => void;
  setVadStatus: (status: VADStatus) => void;
  resetVadState: () => void;
}

export const useVoiceStore = create<VoiceState>((set, get) => {
  const initialSettings = loadSavedVoiceSettings();

  const persistSettings = () => {
    const s = get();
    saveVoiceSettings({
      smartListeningEnabled: s.smartListeningEnabled,
      silenceTimeoutMs: s.silenceTimeoutMs,
      vadSensitivity: s.vadSensitivity,
      conversationalMode: s.conversationalMode,
      ttsProvider: s.ttsProvider,
      activeVoiceId: s.activeVoiceId,
      speed: s.speed,
      wakeWordEnabled: s.wakeWordEnabled,
      wakeWord: s.wakeWord,
    });
  };

  return {
    ...initialSettings,
    isRecording: false,
    isProcessing: false,
    isSpeaking: false,
    transcribedText: '',
    audioLevel: 0,
    lastSpokenText: '',
    isSpeechDetected: false,
    silenceProgress: 0,
    vadStatus: 'idle',

    setIsRecording: (isRecording) => set({ isRecording }),
    setIsProcessing: (isProcessing) => set({ isProcessing }),
    setIsSpeaking: (isSpeaking) => set({ isSpeaking }),
    setTtsProvider: (ttsProvider) => {
      set({ ttsProvider });
      persistSettings();
    },
    setActiveVoiceId: (activeVoiceId) => {
      set({ activeVoiceId });
      persistSettings();
    },
    setWakeWordEnabled: (wakeWordEnabled) => {
      set({ wakeWordEnabled });
      persistSettings();
    },
    setWakeWord: (wakeWord) => {
      set({ wakeWord });
      persistSettings();
    },
    setTranscribedText: (transcribedText) => set({ transcribedText }),
    setAudioLevel: (audioLevel) => set({ audioLevel }),
    setLastSpokenText: (lastSpokenText) => set({ lastSpokenText }),
    setSpeed: (speed) => {
      set({ speed });
      persistSettings();
    },

    setSmartListeningEnabled: (smartListeningEnabled) => {
      set({ smartListeningEnabled });
      persistSettings();
    },
    setSilenceTimeoutMs: (silenceTimeoutMs) => {
      set({ silenceTimeoutMs });
      persistSettings();
    },
    setVadSensitivity: (vadSensitivity) => {
      set({ vadSensitivity });
      persistSettings();
    },
    setConversationalMode: (conversationalMode) => {
      set({ conversationalMode });
      persistSettings();
    },
    setIsSpeechDetected: (isSpeechDetected) => set({ isSpeechDetected }),
    setSilenceProgress: (silenceProgress) => set({ silenceProgress }),
    setVadStatus: (vadStatus) => set({ vadStatus }),
    resetVadState: () =>
      set({
        isSpeechDetected: false,
        silenceProgress: 0,
        vadStatus: 'idle',
      }),
  };
});
