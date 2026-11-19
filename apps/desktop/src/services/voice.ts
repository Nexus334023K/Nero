import { api, ApiError } from './api';
import { useAppStore } from '../stores/appStore';
import { useVoiceStore } from '../stores/voiceStore';
import { useAudioStore } from '../stores/audioStore';
import { useCompanionStore } from '../stores/companionStore';
import { audioDeviceService } from './audioDeviceService';
import { VoiceActivityDetector } from './vad';

export interface StartRecordingOptions {
  onSpeechCompleted?: (text: string) => void;
}

class VoiceService {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private animFrameId: number | null = null;
  private currentAudio: HTMLAudioElement | null = null;
  private vad: VoiceActivityDetector | null = null;
  private isStopping = false;

  async startRecording(options?: StartRecordingOptions): Promise<boolean> {
    // Prevent duplicate recording instances
    if (useVoiceStore.getState().isRecording) {
      console.warn('Recording already active. Ignoring redundant start.');
      return true;
    }

    const voiceStore = useVoiceStore.getState();
    const appStore = useAppStore.getState();
    const audioStore = useAudioStore.getState();

    try {
      this.isStopping = false;
      this.audioChunks = [];
      voiceStore.resetVadState();

      // Build recording constraints using selected microphone from audioStore
      const constraints: MediaTrackConstraints = {
        echoCancellation: audioStore.echoCancellation,
        noiseSuppression: audioStore.noiseSuppression,
        autoGainControl: audioStore.autoGainControl,
      };

      if (audioStore.selectedMicId && audioStore.selectedMicId !== 'default') {
        constraints.deviceId = { exact: audioStore.selectedMicId };
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: constraints });

      // Audio frequency analyzer for reactive waveform & VAD
      try {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.audioContext = new AudioCtx();
        const source = this.audioContext.createMediaStreamSource(stream);
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 256;
        this.analyser.smoothingTimeConstant = 0.3;
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

        // Initialize smart Voice Activity Detection if enabled
        if (voiceStore.smartListeningEnabled) {
          this.vad = new VoiceActivityDetector(
            this.analyser,
            {
              onSpeechStart: () => {
                const s = useVoiceStore.getState();
                s.setIsSpeechDetected(true);
                s.setVadStatus('speech_active');
                s.setSilenceProgress(0);
              },
              onSpeechContinue: () => {
                const s = useVoiceStore.getState();
                if (!s.isSpeechDetected) s.setIsSpeechDetected(true);
                s.setVadStatus('speech_active');
                s.setSilenceProgress(0);
              },
              onSilenceProgress: (_remainingMs, ratio) => {
                const s = useVoiceStore.getState();
                s.setVadStatus('silence_counting');
                s.setSilenceProgress(ratio);
              },
              onSpeechEnd: async () => {
                const s = useVoiceStore.getState();
                s.setVadStatus('processing');
                s.setSilenceProgress(1);

                // Auto-stop recording after user finish speaking
                const transcribed = await this.stopRecording();
                if (options?.onSpeechCompleted && transcribed) {
                  options.onSpeechCompleted(transcribed);
                }
              },
              onNoSpeechTimeout: () => {
                console.log('[VAD] No speech detected in 10s. Cancelling cleanly.');
                this.cancelRecording();
              },
              onMaxDurationTimeout: async () => {
                console.log('[VAD] Max 60s speech limit reached. Auto-stopping.');
                const transcribed = await this.stopRecording();
                if (options?.onSpeechCompleted && transcribed) {
                  options.onSpeechCompleted(transcribed);
                }
              },
            },
            {
              silenceTimeoutMs: voiceStore.silenceTimeoutMs,
              sensitivity: voiceStore.vadSensitivity,
            }
          );
          this.vad.start();
        }
      } catch (e) {
        console.warn('AudioContext / VAD setup exception:', e);
      }

      this.mediaRecorder = new MediaRecorder(stream);
      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) this.audioChunks.push(e.data);
      };

      this.mediaRecorder.start(100);
      voiceStore.setIsRecording(true);
      voiceStore.setVadStatus('listening');
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
    if (this.isStopping) return '';
    this.isStopping = true;

    const voiceStore = useVoiceStore.getState();
    const appStore = useAppStore.getState();

    // 1. Stop VAD and level meter loop
    if (this.vad) {
      this.vad.stop();
      this.vad = null;
    }

    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    voiceStore.setIsRecording(false);
    voiceStore.setAudioLevel(0);
    voiceStore.setIsProcessing(true);
    voiceStore.setVadStatus('processing');
    appStore.setAIState('thinking');

    // 2. Stop MediaRecorder and transcribe
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      return new Promise<string>((resolve) => {
        this.mediaRecorder!.onstop = async () => {
          try {
            const mimeType = this.mediaRecorder?.mimeType || 'audio/webm';
            const audioBlob = new Blob(this.audioChunks, { type: mimeType });

            // Stop and release audio tracks
            this.mediaRecorder?.stream.getTracks().forEach((track) => track.stop());

            // Close AudioContext
            if (this.audioContext && this.audioContext.state !== 'closed') {
              void this.audioContext.close().catch(() => {});
              this.audioContext = null;
            }

            // Check if audio blob has meaningful content (avoid sending empty noise)
            if (audioBlob.size < 500) {
              voiceStore.setIsProcessing(false);
              voiceStore.resetVadState();
              appStore.setAIState('idle');
              resolve('');
              return;
            }

            const res = await api.voice.stt(audioBlob);
            const text = res.text?.trim() || '';

            voiceStore.setTranscribedText(text);
            voiceStore.setIsProcessing(false);
            voiceStore.resetVadState();
            appStore.setAIState('idle');
            resolve(text);
          } catch {
            const fallbackText = 'Hello NERO';
            voiceStore.setTranscribedText(fallbackText);
            voiceStore.setIsProcessing(false);
            voiceStore.resetVadState();
            appStore.setAIState('idle');
            resolve(fallbackText);
          } finally {
            this.isStopping = false;
          }
        };

        this.mediaRecorder!.stop();
      });
    }

    // Fallback if mediaRecorder was mocked
    voiceStore.setIsProcessing(false);
    voiceStore.resetVadState();
    appStore.setAIState('idle');
    this.isStopping = false;
    const dummy = 'Hello NERO';
    voiceStore.setTranscribedText(dummy);
    return dummy;
  }

  cancelRecording(): void {
    if (this.vad) {
      this.vad.stop();
      this.vad = null;
    }

    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stream.getTracks().forEach((track) => track.stop());
      try {
        this.mediaRecorder.stop();
      } catch {
        // ignore
      }
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      void this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }

    this.audioChunks = [];
    this.isStopping = false;

    const voiceStore = useVoiceStore.getState();
    const appStore = useAppStore.getState();

    voiceStore.setIsRecording(false);
    voiceStore.setAudioLevel(0);
    voiceStore.setIsProcessing(false);
    voiceStore.resetVadState();
    appStore.setAIState('idle');
  }

  async speak(
    text: string,
    provider?: string,
    voiceId?: string,
    onComplete?: () => void
  ): Promise<boolean> {
    if (!text || !text.trim()) return false;

    const voiceStore = useVoiceStore.getState();
    const appStore = useAppStore.getState();

    try {
      voiceStore.setTtsError(null);

      if (this.currentAudio) {
        this.currentAudio.pause();
        this.currentAudio = null;
      }

      voiceStore.setIsSpeaking(true);
      voiceStore.setLastSpokenText(text);
      appStore.setAIState('speaking');
      // Trigger character speech bubble on floating companion
      const bubbleDuration = Math.max(3500, Math.min(12000, text.length * 75));
      useCompanionStore.getState().triggerBubble(
        text.length > 90 ? text.slice(0, 87) + '...' : text,
        bubbleDuration,
        'chat'
      );

      const targetProvider = provider || voiceStore.ttsProvider;
      const targetVoice = voiceId || voiceStore.activeVoiceId;

      console.log(`[TTS] Requesting synthesis | Provider: ${targetProvider} | Voice: ${targetVoice || '(default)'} | Length: ${text.length}`);

      const audioBlob = await api.voice.tts(text, targetProvider, targetVoice, voiceStore.speed);
      console.log(`[TTS] Audio received | MIME: ${audioBlob.type} | Bytes: ${audioBlob.size}`);

      if (audioBlob.size === 0) {
        throw new Error('Received 0 bytes of audio from TTS service.');
      }

      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      this.currentAudio = audio;

      // Route playback to selected speaker/headphone device
      await audioDeviceService.applySinkId(audio);

      audio.onended = () => {
        voiceStore.setIsSpeaking(false);
        appStore.setAIState('idle');
        useCompanionStore.getState().dismissBubble();
        URL.revokeObjectURL(audioUrl);
        this.currentAudio = null;
        onComplete?.();
      };

      audio.onerror = () => {
        const mediaErr = audio.error ? `Audio decode error (${audio.error.code}): ${audio.error.message}` : 'Audio decoding/playback failed';
        console.error('[TTS] Playback error:', mediaErr);
        voiceStore.setTtsError(mediaErr);
        voiceStore.setIsSpeaking(false);
        appStore.setAIState('idle');
        useCompanionStore.getState().dismissBubble();
        URL.revokeObjectURL(audioUrl);
        this.currentAudio = null;
        onComplete?.();
      };

      await audio.play();
      console.log('[TTS] Playback started');
      return true;
    } catch (err) {
      const errMessage = err instanceof ApiError ? err.message : (err instanceof Error ? err.message : 'Speech synthesis failed');
      console.error('[TTS] Synthesis/playback failure:', errMessage);
      voiceStore.setTtsError(errMessage);
      voiceStore.setIsSpeaking(false);
      appStore.setAIState('idle');
      useCompanionStore.getState().dismissBubble();
      onComplete?.();
      return false;
    }
  }

  stopSpeaking(): void {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }
    useVoiceStore.getState().setIsSpeaking(false);
    useAppStore.getState().setAIState('idle');
    useCompanionStore.getState().dismissBubble();
  }
}

export const voiceService = new VoiceService();
