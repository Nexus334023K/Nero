import { create } from 'zustand';

export interface VoiceState {
  isRecording: boolean;
  isProcessing: boolean;
  isSpeaking: boolean;
  ttsProvider: string;
  activeVoiceId: string;
  wakeWordEnabled: boolean;
  wakeWord: string;
  transcribedText: string;
  audioLevel: number;
  lastSpokenText: string;
  speed: number;

  setIsRecording: (isRecording: boolean) => void;
  setIsProcessing: (isProcessing: boolean) => void;
  setIsSpeaking: (isSpeaking: boolean) => void;
  setTtsProvider: (ttsProvider: string) => void;
  setActiveVoiceId: (activeVoiceId: string) => void;
  setWakeWordEnabled: (wakeWordEnabled: boolean) => void;
  setTranscribedText: (text: string) => void;
  setAudioLevel: (level: number) => void;
  setLastSpokenText: (text: string) => void;
  setSpeed: (speed: number) => void;
}

export const useVoiceStore = create<VoiceState>((set) => ({
  isRecording: false,
  isProcessing: false,
  isSpeaking: false,
  ttsProvider: 'fish_audio',
  activeVoiceId: '54f224d5500e482390f77977a41496d0',
  wakeWordEnabled: false,
  wakeWord: 'nero',
  transcribedText: '',
  audioLevel: 0,
  lastSpokenText: '',
  speed: 1.0,

  setIsRecording: (isRecording) => set({ isRecording }),
  setIsProcessing: (isProcessing) => set({ isProcessing }),
  setIsSpeaking: (isSpeaking) => set({ isSpeaking }),
  setTtsProvider: (ttsProvider) => set({ ttsProvider }),
  setActiveVoiceId: (activeVoiceId) => set({ activeVoiceId }),
  setWakeWordEnabled: (wakeWordEnabled) => set({ wakeWordEnabled }),
  setTranscribedText: (transcribedText) => set({ transcribedText }),
  setAudioLevel: (audioLevel) => set({ audioLevel }),
  setLastSpokenText: (lastSpokenText) => set({ lastSpokenText }),
  setSpeed: (speed) => set({ speed }),
}));
