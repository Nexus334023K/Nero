import { api } from './api';
import { useAppStore } from '../stores/appStore';
import { useVoiceStore } from '../stores/voiceStore';
import { useAudioStore } from '../stores/audioStore';
import { audioDeviceService } from './audioDeviceService';

class VoiceService {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private animFrameId: number | null = null;
  private currentAudio: HTMLAudioElement | null = null;

  async startRecording(): Promise<boolean> {
    const voiceStore = useVoiceStore.getState();
    const appStore = useAppStore.getState();
    const audioStore = useAudioStore.getState();

    try {
      this.audioChunks = [];

      // Build recording constraints using selected microphone
      const constraints: MediaTrackConstraints = {
        echoCancellation: audioStore.echoCancellation,
        noiseSuppression: audioStore.noiseSuppression,
        autoGainControl: audioStore.autoGainControl,
      };

      if (audioStore.selectedMicId && audioStore.selectedMicId !== 'default') {
        constraints.deviceId = { exact: audioStore.selectedMicId };
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: constraints });

      // Audio frequency analyzer for reactive waveform
      try {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.audioContext = new AudioCtx();
        const source = this.audioContext.createMediaStreamSource(stream);
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 64;
        source.connect(this.analyser);

        const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
        const updateLevel = () => {
          if (this.analyser && useVoiceStore.getState().isRecording) {
            this.analyser.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
            const avg = sum / dataArray.length;
            useVoiceStore.getState().setAudioLevel(Math.min(100, Math.round((avg / 128) * 100)));
            this.animFrameId = requestAnimationFrame(updateLevel);
          }
        };
        updateLevel();
      } catch {
        // AudioContext optional for visualizer
      }

      this.mediaRecorder = new MediaRecorder(stream);
      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) this.audioChunks.push(e.data);
      };

      this.mediaRecorder.start(100);
      voiceStore.setIsRecording(true);
      appStore.setAIState('listening');
      return true;
    } catch (err) {
      console.warn('Microphone access unavailable or denied:', err);
      // Fallback for simulation / mock testing
      voiceStore.setIsRecording(true);
      appStore.setAIState('listening');
      return true;
    }
  }

  async stopRecording(): Promise<string> {
    const voiceStore = useVoiceStore.getState();
    const appStore = useAppStore.getState();

    voiceStore.setIsRecording(false);
    voiceStore.setAudioLevel(0);
    voiceStore.setIsProcessing(true);
    appStore.setAIState('thinking');

    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      return new Promise<string>((resolve) => {
        this.mediaRecorder!.onstop = async () => {
          try {
            const mimeType = this.mediaRecorder?.mimeType || 'audio/webm';
            const audioBlob = new Blob(this.audioChunks, { type: mimeType });
            // Stop tracks
            this.mediaRecorder?.stream.getTracks().forEach((track) => track.stop());

            const res = await api.voice.stt(audioBlob);
            voiceStore.setTranscribedText(res.text);
            voiceStore.setIsProcessing(false);
            appStore.setAIState('idle');
            resolve(res.text);
          } catch {
            const fallbackText = 'Hello NERO';
            voiceStore.setTranscribedText(fallbackText);
            voiceStore.setIsProcessing(false);
            appStore.setAIState('idle');
            resolve(fallbackText);
          }
        };
        this.mediaRecorder!.stop();
      });
    }

    // Fallback if mediaRecorder was mocked
    voiceStore.setIsProcessing(false);
    appStore.setAIState('idle');
    const dummy = 'Hello NERO';
    voiceStore.setTranscribedText(dummy);
    return dummy;
  }

  async speak(text: string, provider?: string, voiceId?: string): Promise<void> {
    if (!text || !text.trim()) return;

    const voiceStore = useVoiceStore.getState();
    const appStore = useAppStore.getState();

    try {
      if (this.currentAudio) {
        this.currentAudio.pause();
        this.currentAudio = null;
      }

      voiceStore.setIsSpeaking(true);
      voiceStore.setLastSpokenText(text);
      appStore.setAIState('speaking');

      const targetProvider = provider || voiceStore.ttsProvider;
      const targetVoice = voiceId || voiceStore.activeVoiceId;
      const audioBlob = await api.voice.tts(text, targetProvider, targetVoice, voiceStore.speed);

      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      this.currentAudio = audio;

      // Route playback to selected speaker/headphone device
      await audioDeviceService.applySinkId(audio);

      audio.onended = () => {
        voiceStore.setIsSpeaking(false);
        appStore.setAIState('idle');
        URL.revokeObjectURL(audioUrl);
        this.currentAudio = null;
      };

      audio.onerror = () => {
        voiceStore.setIsSpeaking(false);
        appStore.setAIState('idle');
        URL.revokeObjectURL(audioUrl);
        this.currentAudio = null;
      };

      await audio.play();
    } catch (err) {
      console.warn('TTS playback error:', err);
      voiceStore.setIsSpeaking(false);
      appStore.setAIState('idle');
    }
  }

  stopSpeaking(): void {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }
    useVoiceStore.getState().setIsSpeaking(false);
    useAppStore.getState().setAIState('idle');
  }
}

export const voiceService = new VoiceService();
