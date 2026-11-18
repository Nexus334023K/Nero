import React, { useEffect, useState } from 'react';
import { useAudioStore } from '../../../stores/audioStore';
import { useVoiceStore, type VADSensitivity } from '../../../stores/voiceStore';
import { audioDeviceService } from '../../../services/audioDeviceService';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';

export const AudioDeviceSettings: React.FC = () => {
  const {
    microphones,
    speakers,
    selectedMicId,
    selectedSpeakerId,
    echoCancellation,
    noiseSuppression,
    autoGainControl,
    permissionGranted,
    deviceWarning,
    isLoadingDevices,
    setSelectedMicId,
    setSelectedSpeakerId,
    setEchoCancellation,
    setNoiseSuppression,
    setAutoGainControl,
    setDeviceWarning,
    refreshDevices,
    requestPermission,
    initDeviceListener,
  } = useAudioStore();

  const {
    smartListeningEnabled,
    silenceTimeoutMs,
    vadSensitivity,
    conversationalMode,
    setSmartListeningEnabled,
    setSilenceTimeoutMs,
    setVadSensitivity,
    setConversationalMode,
  } = useVoiceStore();

  const [isTestingMic, setIsTestingMic] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [isPlayingSpeakerTest, setIsPlayingSpeakerTest] = useState(false);
  const [speakerTestFeedback, setSpeakerTestFeedback] = useState<string | null>(null);

  // Initialize listener on mount
  useEffect(() => {
    const cleanup = initDeviceListener();
    return () => {
      cleanup();
      audioDeviceService.stopMicTest();
    };
  }, [initDeviceListener]);

  const handleToggleMicTest = async () => {
    if (isTestingMic) {
      audioDeviceService.stopMicTest();
      setIsTestingMic(false);
      setMicLevel(0);
    } else {
      const ok = await audioDeviceService.startMicTest((level) => {
        setMicLevel(level);
      });
      if (ok) {
        setIsTestingMic(true);
      }
    }
  };

  const handleTestSpeaker = async () => {
    setIsPlayingSpeakerTest(true);
    setSpeakerTestFeedback(null);
    try {
      const res = await audioDeviceService.testSpeaker();
      setSpeakerTestFeedback(res.message);
    } catch {
      setSpeakerTestFeedback('Speaker test failed');
    } finally {
      setTimeout(() => {
        setIsPlayingSpeakerTest(false);
      }, 1000);
    }
  };

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xs font-mono uppercase tracking-widest text-nero-muted">
            Audio & Input/Output Devices
          </h2>
          <p className="text-[11px] text-nero-muted mt-0.5">
            Configure microphone recording capture and speech synthesis output routing.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => void refreshDevices()}
          disabled={isLoadingDevices}
          icon={
            <span className={isLoadingDevices ? 'animate-spin' : ''}>🔄</span>
          }
        >
          {isLoadingDevices ? 'Scanning...' : 'Refresh Devices'}
        </Button>
      </div>

      {/* Disconnection Warning Banner */}
      {deviceWarning && (
        <div className="p-3 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>⚠️</span>
            <span>{deviceWarning}</span>
          </div>
          <button
            onClick={() => setDeviceWarning(null)}
            className="text-amber-300/70 hover:text-amber-200 text-sm ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* Permission Request Prompt if not yet granted */}
      {!permissionGranted && (
        <div className="p-3.5 rounded-lg bg-nero-cyan/10 border border-nero-cyan/30 text-xs flex items-center justify-between">
          <div>
            <p className="font-semibold text-nero-cyan">Microphone Permission Needed for Full Labels</p>
            <p className="text-nero-muted text-[11px] mt-0.5">
              Browser security hides hardware names until access is authorized.
            </p>
          </div>
          <Button variant="primary" size="sm" onClick={() => void requestPermission()}>
            Grant Access
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Microphone / Input Section */}
        <Card className="flex flex-col gap-4" animate={false}>
          <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="text-nero-cyan text-sm">🎙️</span>
              <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-nero-text">
                Microphone (Input Device)
              </h3>
            </div>
            <span className="text-[10px] font-mono text-nero-cyan">
              {microphones.length} Detected
            </span>
          </div>

          <div>
            <label className="text-[10px] font-mono uppercase text-nero-muted block mb-1.5">
              Active Input Microphone
            </label>
            <select
              value={selectedMicId}
              onChange={(e) => {
                setSelectedMicId(e.target.value);
                if (isTestingMic) {
                  audioDeviceService.stopMicTest();
                  setIsTestingMic(false);
                  setMicLevel(0);
                }
              }}
              className="w-full text-xs font-mono bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-nero-text focus:border-nero-cyan/50 outline-none cursor-pointer"
            >
              <option value="default">Default System Microphone</option>
              {microphones
                .filter((m) => m.deviceId !== 'default')
                .map((mic) => (
                  <option key={mic.deviceId} value={mic.deviceId}>
                    {mic.label} {mic.isDefault ? '(System Default)' : ''}
                  </option>
                ))}
            </select>
          </div>

          {/* Live Microphone Test & Level Bar */}
          <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5 flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-nero-muted font-mono uppercase">
                Input Level Indicator
              </span>
              <span className="text-[10px] font-mono text-nero-cyan">{micLevel}%</span>
            </div>

            {/* LED Level Bar */}
            <div className="w-full bg-black/50 h-2.5 rounded-full overflow-hidden border border-white/10 p-[1px]">
              <div
                className={`h-full rounded-full transition-all duration-75 ${
                  micLevel > 80
                    ? 'bg-red-400'
                    : micLevel > 50
                    ? 'bg-amber-400'
                    : 'bg-nero-cyan'
                }`}
                style={{
                  width: `${isTestingMic ? micLevel : 0}%`,
                  boxShadow: isTestingMic && micLevel > 0 ? '0 0 8px rgba(0,212,255,0.6)' : 'none',
                }}
              />
            </div>

            <Button
              variant={isTestingMic ? 'danger' : 'secondary'}
              size="sm"
              onClick={handleToggleMicTest}
              className="w-full justify-center mt-1"
            >
              {isTestingMic ? 'Stop Mic Test' : 'Test Microphone'}
            </Button>
          </div>

          {/* Audio Preprocessing Constraints */}
          <div className="border-t border-white/5 pt-3 space-y-2">
            <span className="text-[10px] font-mono uppercase text-nero-muted block">
              Hardware Pre-Processing
            </span>
            <div className="grid grid-cols-3 gap-2">
              <label className="flex items-center gap-1.5 text-[11px] text-nero-text cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={echoCancellation}
                  onChange={(e) => setEchoCancellation(e.target.checked)}
                  className="rounded border-white/20 bg-black/60 text-nero-cyan focus:ring-0"
                />
                <span>Echo Cancel</span>
              </label>

              <label className="flex items-center gap-1.5 text-[11px] text-nero-text cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={noiseSuppression}
                  onChange={(e) => setNoiseSuppression(e.target.checked)}
                  className="rounded border-white/20 bg-black/60 text-nero-cyan focus:ring-0"
                />
                <span>Noise Suppress</span>
              </label>

              <label className="flex items-center gap-1.5 text-[11px] text-nero-text cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={autoGainControl}
                  onChange={(e) => setAutoGainControl(e.target.checked)}
                  className="rounded border-white/20 bg-black/60 text-nero-cyan focus:ring-0"
                />
                <span>Auto Gain</span>
              </label>
            </div>
          </div>
        </Card>

        {/* Speakers / Output Section */}
        <Card className="flex flex-col gap-4" animate={false}>
          <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="text-nero-cyan text-sm">🔊</span>
              <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-nero-text">
                Speakers & Headphones (Output Device)
              </h3>
            </div>
            <span className="text-[10px] font-mono text-nero-cyan">
              {speakers.length} Detected
            </span>
          </div>

          <div>
            <label className="text-[10px] font-mono uppercase text-nero-muted block mb-1.5">
              Active Playback Device
            </label>
            <select
              value={selectedSpeakerId}
              onChange={(e) => setSelectedSpeakerId(e.target.value)}
              className="w-full text-xs font-mono bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-nero-text focus:border-nero-cyan/50 outline-none cursor-pointer"
            >
              <option value="default">Default System Audio Output</option>
              {speakers
                .filter((s) => s.deviceId !== 'default')
                .map((spk) => (
                  <option key={spk.deviceId} value={spk.deviceId}>
                    {spk.label} {spk.isDefault ? '(System Default)' : ''}
                  </option>
                ))}
            </select>
          </div>

          {/* Test Speaker Chime */}
          <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5 flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-nero-muted font-mono uppercase">
                Playback Verification
              </span>
              <span className="text-[10px] font-mono text-nero-cyan">Melodic Chime</span>
            </div>

            <p className="text-[11px] text-nero-muted">
              Sends an audio chime through the selected speaker or headphone output.
            </p>

            <Button
              variant="secondary"
              size="sm"
              onClick={handleTestSpeaker}
              disabled={isPlayingSpeakerTest}
              className="w-full justify-center mt-1"
              icon={<span>🔔</span>}
            >
              {isPlayingSpeakerTest ? 'Playing Test Chime...' : 'Play Test Chime'}
            </Button>

            {speakerTestFeedback && (
              <p className="text-[10px] text-nero-cyan font-mono text-center mt-0.5">
                {speakerTestFeedback}
              </p>
            )}
          </div>

          {/* Output Information */}
          <div className="border-t border-white/5 pt-3">
            <span className="text-[10px] font-mono uppercase text-nero-muted block mb-1">
              Routing Capabilities
            </span>
            <p className="text-[11px] text-nero-muted leading-relaxed">
              NERO uses Chromium <code className="text-nero-cyan font-mono text-[10px]">HTMLMediaElement.setSinkId()</code> to route AI voice responses directly to your chosen headphones or speakers without altering Windows system audio.
            </p>
          </div>
        </Card>
      </div>

      {/* Smart Voice Activity Detection & Silence Termination */}
      <Card className="flex flex-col gap-4" animate={false}>
        <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
          <div className="flex items-center gap-2">
            <span className="text-nero-cyan text-sm">🧠</span>
            <div>
              <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-nero-text">
                Smart Voice Listening & Silence Detection
              </h3>
              <p className="text-[11px] text-nero-muted">
                Automatically detects when you speak and terminates recording after natural pauses.
              </p>
            </div>
          </div>
          <button
            onClick={() => setSmartListeningEnabled(!smartListeningEnabled)}
            className={`px-3 py-1 rounded-full text-xs font-mono font-semibold transition-all ${
              smartListeningEnabled
                ? 'bg-nero-cyan/20 border border-nero-cyan text-nero-cyan'
                : 'bg-white/10 text-nero-muted hover:text-white'
            }`}
          >
            {smartListeningEnabled ? 'ENABLED' : 'DISABLED'}
          </button>
        </div>

        {smartListeningEnabled && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Silence Duration Presets */}
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-mono uppercase text-nero-muted">
                End-of-Speech Silence Pause
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { label: 'Short', ms: 700, desc: '700ms' },
                  { label: 'Normal', ms: 1200, desc: '1.2s' },
                  { label: 'Relaxed', ms: 1800, desc: '1.8s' },
                ].map((preset) => (
                  <button
                    key={preset.ms}
                    type="button"
                    onClick={() => setSilenceTimeoutMs(preset.ms)}
                    className={`py-2 px-1.5 rounded-lg border text-center transition-all ${
                      silenceTimeoutMs === preset.ms
                        ? 'border-nero-cyan bg-nero-cyan/15 text-nero-cyan'
                        : 'border-white/5 bg-white/[0.02] text-nero-muted hover:border-white/20'
                    }`}
                  >
                    <div className="text-xs font-bold">{preset.label}</div>
                    <div className="text-[10px] opacity-75">{preset.desc}</div>
                  </button>
                ))}
              </div>

              {/* Custom Silence Slider */}
              <div className="mt-1 flex items-center justify-between text-[11px] text-nero-muted">
                <span>Custom: {silenceTimeoutMs} ms</span>
                <input
                  type="range"
                  min="500"
                  max="3000"
                  step="100"
                  value={silenceTimeoutMs}
                  onChange={(e) => setSilenceTimeoutMs(Number(e.target.value))}
                  className="w-28 accent-nero-cyan cursor-pointer"
                />
              </div>
            </div>

            {/* VAD Sensitivity */}
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-mono uppercase text-nero-muted">
                Speech Detection Sensitivity
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {(['low', 'medium', 'high'] as VADSensitivity[]).map((sens) => (
                  <button
                    key={sens}
                    type="button"
                    onClick={() => setVadSensitivity(sens)}
                    className={`py-2 px-1.5 rounded-lg border text-center uppercase text-xs font-bold transition-all ${
                      vadSensitivity === sens
                        ? 'border-nero-cyan bg-nero-cyan/15 text-nero-cyan'
                        : 'border-white/5 bg-white/[0.02] text-nero-muted hover:border-white/20'
                    }`}
                  >
                    {sens}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-nero-muted leading-tight mt-1">
                {vadSensitivity === 'low'
                  ? 'High noise rejection for noisy environments.'
                  : vadSensitivity === 'high'
                  ? 'High sensitivity for whispers and soft spoken speech.'
                  : 'Balanced sensitivity for standard natural speech.'}
              </p>
            </div>

            {/* Conversational Loop */}
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-mono uppercase text-nero-muted">
                Continuous Dialogue Mode
              </label>
              <button
                type="button"
                onClick={() => setConversationalMode(!conversationalMode)}
                className={`p-2.5 rounded-lg border text-left flex items-center justify-between transition-all ${
                  conversationalMode
                    ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-400'
                    : 'border-white/5 bg-white/[0.02] text-nero-muted hover:border-white/20'
                }`}
              >
                <div>
                  <div className="text-xs font-bold">Auto-Resume Listening</div>
                  <div className="text-[10px] opacity-80">
                    Automatically listens after NERO responds
                  </div>
                </div>
                <span className="font-mono text-xs font-bold">
                  {conversationalMode ? 'ON' : 'OFF'}
                </span>
              </button>
              <p className="text-[10px] text-nero-muted leading-tight">
                Enables hands-free voice conversations without having to press any buttons between turns.
              </p>
            </div>
          </div>
        )}
      </Card>
    </section>
  );
};
