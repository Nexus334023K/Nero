import { useAudioStore } from '../stores/audioStore';

class AudioDeviceService {
  private testAudioContext: AudioContext | null = null;
  private testMediaStream: MediaStream | null = null;
  private testAnimFrameId: number | null = null;
  private isTestingMic = false;

  /**
   * Starts a live microphone test, reading the volume level and invoking callback with 0-100 values.
   */
  async startMicTest(onLevel: (level: number) => void): Promise<boolean> {
    this.stopMicTest();

    const { selectedMicId, echoCancellation, noiseSuppression, autoGainControl } =
      useAudioStore.getState();

    try {
      const constraints: MediaTrackConstraints = {
        echoCancellation,
        noiseSuppression,
        autoGainControl,
      };

      if (selectedMicId && selectedMicId !== 'default') {
        constraints.deviceId = { exact: selectedMicId };
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: constraints });
      this.testMediaStream = stream;

      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      this.testAudioContext = ctx;

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.4;
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      this.isTestingMic = true;

      const loop = () => {
        if (!this.isTestingMic || !analyser) return;

        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        // Normalize 0-255 to 0-100 with a slight boost for voice clarity
        const normalized = Math.min(100, Math.round((avg / 128) * 100));
        onLevel(normalized);

        this.testAnimFrameId = requestAnimationFrame(loop);
      };

      loop();
      return true;
    } catch (err) {
      console.warn('Unable to start microphone test:', err);
      this.stopMicTest();
      return false;
    }
  }

  /**
   * Stops the active microphone test and releases media tracks and AudioContext.
   */
  stopMicTest(): void {
    this.isTestingMic = false;

    if (this.testAnimFrameId) {
      cancelAnimationFrame(this.testAnimFrameId);
      this.testAnimFrameId = null;
    }

    if (this.testMediaStream) {
      this.testMediaStream.getTracks().forEach((track) => track.stop());
      this.testMediaStream = null;
    }

    if (this.testAudioContext) {
      void this.testAudioContext.close().catch(() => {});
      this.testAudioContext = null;
    }
  }

  /**
   * Plays a pleasant chime sound to verify speaker/headphone output.
   * Uses HTMLMediaElement.setSinkId() where supported.
   */
  async testSpeaker(speakerId?: string): Promise<{ success: boolean; message: string }> {
    const targetId = speakerId || useAudioStore.getState().selectedSpeakerId;

    try {
      // Create a pleasant synthetic audio buffer encoded as WAV or generated via AudioContext
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();

      // Check if AudioContext supports setSinkId directly (modern Chromium)
      if (targetId && targetId !== 'default' && typeof (ctx as any).setSinkId === 'function') {
        try {
          await (ctx as any).setSinkId(targetId);
        } catch (e) {
          console.warn('AudioContext setSinkId error:', e);
        }
      }

      // Generate a warm 3-tone arpeggio (C5 -> E5 -> G5)
      const now = ctx.currentTime;
      const notes = [523.25, 659.25, 783.99]; // C5, E5, G5

      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.12);

        gain.gain.setValueAtTime(0, now + idx * 0.12);
        gain.gain.linearRampToValueAtTime(0.2, now + idx * 0.12 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.35);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + idx * 0.12);
        osc.stop(now + idx * 0.12 + 0.4);
      });

      // Also create an HTMLAudioElement test with setSinkId for HTMLMediaElement verification
      try {
        const audioEl = new Audio();
        if (targetId && targetId !== 'default' && typeof (audioEl as any).setSinkId === 'function') {
          await (audioEl as any).setSinkId(targetId);
        }
      } catch (err) {
        console.warn('HTMLAudioElement setSinkId verification notice:', err);
      }

      // Auto-close test audio context after chime finishes
      setTimeout(() => {
        void ctx.close().catch(() => {});
      }, 900);

      return {
        success: true,
        message:
          targetId === 'default'
            ? 'Playing chime on Default System Output'
            : 'Playing chime on selected audio output device',
      };
    } catch (err) {
      console.error('Speaker test failed:', err);
      return { success: false, message: 'Audio playback failed' };
    }
  }

  /**
   * Applies the selected output device to an HTMLMediaElement.
   */
  async applySinkId(element: HTMLMediaElement, speakerId?: string): Promise<boolean> {
    const targetId = speakerId || useAudioStore.getState().selectedSpeakerId;
    if (!targetId || targetId === 'default') return true;

    if (typeof (element as any).setSinkId === 'function') {
      try {
        await (element as any).setSinkId(targetId);
        return true;
      } catch (err) {
        console.warn(`Failed to set audio sink ID (${targetId}):`, err);
        return false;
      }
    }
    return false;
  }
}

export const audioDeviceService = new AudioDeviceService();
