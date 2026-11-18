import type { VADSensitivity } from '../stores/voiceStore';

export interface VADConfig {
  silenceTimeoutMs: number;
  speechStartMinMs?: number;
  minSpeechDurationMs?: number;
  noSpeechTimeoutMs?: number;
  maxRecordingMs?: number;
  sensitivity?: VADSensitivity;
}

export interface VADCallbacks {
  onSpeechStart: () => void;
  onSpeechContinue: (energy: number) => void;
  onSilenceProgress: (remainingMs: number, ratio: number) => void;
  onSpeechEnd: () => void;
  onNoSpeechTimeout: () => void;
  onMaxDurationTimeout: () => void;
}

export class VoiceActivityDetector {
  private analyser: AnalyserNode;
  private callbacks: VADCallbacks;
  private config: Required<VADConfig>;

  private animFrameId: number | null = null;
  private isRunning = false;

  // Audio energy analysis
  private dataArray: Uint8Array<ArrayBuffer>;
  private noiseFloor = 0.015;
  private noiseCalibrationFrames = 0;
  private readonly CALIBRATION_FRAMES = 12; // first ~250ms to sample ambient room noise

  // State machine tracking
  private recordingStartTime = 0;
  private speechStartCandidateTime = 0;
  private hasSpeechStarted = false;
  private speechConfirmedTime = 0;
  private lastSpeechTime = 0;

  constructor(analyser: AnalyserNode, callbacks: VADCallbacks, config: VADConfig) {
    this.analyser = analyser;
    this.callbacks = callbacks;
    this.config = {
      silenceTimeoutMs: config.silenceTimeoutMs || 1200,
      speechStartMinMs: config.speechStartMinMs ?? 250,
      minSpeechDurationMs: config.minSpeechDurationMs ?? 300,
      noSpeechTimeoutMs: config.noSpeechTimeoutMs ?? 10000,
      maxRecordingMs: config.maxRecordingMs ?? 60000,
      sensitivity: config.sensitivity || 'medium',
    };

    this.dataArray = new Uint8Array(new ArrayBuffer(this.analyser.frequencyBinCount));
  }

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.recordingStartTime = performance.now();
    this.speechStartCandidateTime = 0;
    this.hasSpeechStarted = false;
    this.speechConfirmedTime = 0;
    this.lastSpeechTime = 0;
    this.noiseFloor = 0.015;
    this.noiseCalibrationFrames = 0;

    this.tick();
  }

  stop(): void {
    this.isRunning = false;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  updateConfig(newConfig: Partial<VADConfig>): void {
    if (newConfig.silenceTimeoutMs !== undefined) {
      this.config.silenceTimeoutMs = newConfig.silenceTimeoutMs;
    }
    if (newConfig.sensitivity !== undefined) {
      this.config.sensitivity = newConfig.sensitivity;
    }
  }

  private calculateRMS(): number {
    this.analyser.getByteFrequencyData(this.dataArray);
    let sum = 0;
    const len = this.dataArray.length;
    for (let i = 0; i < len; i++) {
      const normalized = this.dataArray[i] / 255;
      sum += normalized * normalized;
    }
    return Math.sqrt(sum / len);
  }

  private getDynamicThreshold(): number {
    switch (this.config.sensitivity) {
      case 'high':
        // Sensitive to quiet voices
        return Math.max(0.02, this.noiseFloor * 1.8 + 0.015);
      case 'low':
        // High threshold to reject noisy backgrounds
        return Math.max(0.06, this.noiseFloor * 3.5 + 0.04);
      case 'medium':
      default:
        return Math.max(0.035, this.noiseFloor * 2.5 + 0.025);
    }
  }

  private tick = (): void => {
    if (!this.isRunning) return;

    const now = performance.now();
    const rms = this.calculateRMS();

    // 1. Initial room noise calibration
    if (this.noiseCalibrationFrames < this.CALIBRATION_FRAMES) {
      this.noiseFloor = (this.noiseFloor * this.noiseCalibrationFrames + rms) / (this.noiseCalibrationFrames + 1);
      this.noiseCalibrationFrames++;
    } else if (!this.hasSpeechStarted) {
      // Dynamic noise floor adaptation while waiting for speech
      if (rms < this.noiseFloor) {
        this.noiseFloor = this.noiseFloor * 0.95 + rms * 0.05;
      } else {
        this.noiseFloor = this.noiseFloor * 0.998 + rms * 0.002;
      }
    }

    const threshold = this.getDynamicThreshold();
    const isAboveThreshold = rms >= threshold;

    // 2. Check hard max recording timeout (60 seconds)
    if (now - this.recordingStartTime >= this.config.maxRecordingMs) {
      this.stop();
      this.callbacks.onMaxDurationTimeout();
      return;
    }

    // 3. Waiting for user speech to start
    if (!this.hasSpeechStarted) {
      // Check no-speech timeout (10 seconds)
      if (now - this.recordingStartTime >= this.config.noSpeechTimeoutMs) {
        this.stop();
        this.callbacks.onNoSpeechTimeout();
        return;
      }

      if (isAboveThreshold) {
        if (this.speechStartCandidateTime === 0) {
          this.speechStartCandidateTime = now;
        } else if (now - this.speechStartCandidateTime >= this.config.speechStartMinMs) {
          // Sustained speech detected for ~250ms!
          this.hasSpeechStarted = true;
          this.speechConfirmedTime = now;
          this.lastSpeechTime = now;
          this.callbacks.onSpeechStart();
        }
      } else {
        // Energy dipped before reaching speechStartMinMs -> discard false trigger
        this.speechStartCandidateTime = 0;
      }
    } else {
      // 4. Speech already started: detect continuation vs silence
      if (isAboveThreshold) {
        this.lastSpeechTime = now;
        this.callbacks.onSpeechContinue(rms);
        this.callbacks.onSilenceProgress(this.config.silenceTimeoutMs, 0);
      } else {
        // User paused speaking
        const silenceElapsed = now - this.lastSpeechTime;
        const remainingMs = Math.max(0, this.config.silenceTimeoutMs - silenceElapsed);
        const ratio = Math.min(1, silenceElapsed / this.config.silenceTimeoutMs);

        this.callbacks.onSilenceProgress(remainingMs, ratio);

        if (silenceElapsed >= this.config.silenceTimeoutMs) {
          const totalSpeechDuration = this.lastSpeechTime - this.speechConfirmedTime;
          if (totalSpeechDuration >= this.config.minSpeechDurationMs) {
            // Valid complete utterance!
            this.stop();
            this.callbacks.onSpeechEnd();
            return;
          } else {
            // Too brief to be meaningful speech (e.g. click/cough)
            this.hasSpeechStarted = false;
            this.speechStartCandidateTime = 0;
          }
        }
      }
    }

    this.animFrameId = requestAnimationFrame(this.tick);
  };
}
