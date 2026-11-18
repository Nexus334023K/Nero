import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useVoiceStore } from '../../stores/voiceStore';
import { useAppStore } from '../../stores/appStore';
import { voiceService } from '../../services/voice';
import { api } from '../../services/api';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';

interface VoiceOption {
  id: string;
  name: string;
  provider: string;
  language: string;
  description?: string;
}

export function VoiceView() {
  const {
    isRecording,
    isProcessing,
    isSpeaking,
    ttsProvider,
    activeVoiceId,
    wakeWordEnabled,
    transcribedText,
    audioLevel,
    isSpeechDetected,
    silenceProgress,
    vadStatus,
    smartListeningEnabled,
    silenceTimeoutMs,
    conversationalMode,
    ttsError,
    setTtsProvider,
    setActiveVoiceId,
    setWakeWordEnabled,
    setSmartListeningEnabled,
    setConversationalMode,
  } = useVoiceStore();

  const { personalityMode, setAIState } = useAppStore();

  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [aiResponse, setAiResponse] = useState<string>('');
  const [isAiThinking, setIsAiThinking] = useState<boolean>(false);
  const conversationalModeRef = useRef(conversationalMode);
  conversationalModeRef.current = conversationalMode;

  const testPhrase = 'Greetings. NERO voice intelligence is online and operational.';

  useEffect(() => {
    api.voice
      .getVoices()
      .then((res) => {
        if (res?.voices) setVoices(res.voices);
      })
      .catch(() => {});
  }, []);

  // Process completed speech utterance through STT -> AI -> TTS
  const handleProcessSpeech = useCallback(
    async (spokenText?: string) => {
      let text = spokenText;
      if (!text && isRecording) {
        text = await voiceService.stopRecording();
      }

      if (!text || !text.trim()) {
        setAIState('idle');
        return;
      }

      try {
        setIsAiThinking(true);
        setAIState('thinking');

        // Send to backend AI
        const chatRes = await api.chat.send(text, undefined, personalityMode);
        const reply = chatRes.response?.trim() || '';
        setAiResponse(reply);
        setIsAiThinking(false);

        if (reply) {
          // Speak AI response and trigger next loop if in conversational mode
          await voiceService.speak(
            reply,
            ttsProvider,
            activeVoiceId,
            () => {
              if (conversationalModeRef.current) {
                // Short breather before re-arming mic
                setTimeout(() => {
                  void handleToggleRecord();
                }, 400);
              }
            }
          );
        } else {
          setAIState('idle');
        }
      } catch (err) {
        console.error('Error processing voice query:', err);
        setIsAiThinking(false);
        setAIState('idle');
      }
    },
    [isRecording, personalityMode, setAIState, ttsProvider, activeVoiceId]
  );

  const handleToggleRecord = useCallback(async () => {
    if (isRecording) {
      await handleProcessSpeech();
    } else {
      setAiResponse('');
      await voiceService.startRecording({
        onSpeechCompleted: (text) => {
          void handleProcessSpeech(text);
        },
      });
    }
  }, [isRecording, handleProcessSpeech]);

  const handleCancelRecord = () => {
    voiceService.cancelRecording();
    setAIState('idle');
  };

  const handleTestVoice = async () => {
    await voiceService.speak(testPhrase, ttsProvider, activeVoiceId);
  };

  return (
    <div className="flex flex-col h-full w-full overflow-y-auto bg-nero-bg p-8">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-6 border-b border-nero-border">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-nero-text flex items-center gap-3">
            <span>Voice Intelligence</span>
            <span className="text-xs px-2.5 py-1 rounded-full border border-nero-cyan/30 bg-nero-cyan/10 text-nero-cyan font-mono">
              Fish Audio + Piper + Whisper
            </span>
          </h1>
          <p className="text-xs text-nero-muted mt-1">
            Real-time conversational speech synthesis, local transcription, and hands-free activation
          </p>
        </div>

        {/* Mode Toggles */}
        <div className="flex items-center gap-3">
          {/* Smart Auto-Stop Toggle */}
          <button
            onClick={() => setSmartListeningEnabled(!smartListeningEnabled)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono transition-colors ${
              smartListeningEnabled
                ? 'border-nero-cyan/50 bg-nero-cyan/10 text-nero-cyan'
                : 'border-white/10 bg-white/5 text-nero-muted hover:text-white'
            }`}
            title="Automatically stop recording when you pause speaking"
          >
            <span>🎙️</span>
            <span>Auto-Stop:</span>
            <strong className="uppercase">{smartListeningEnabled ? 'ON' : 'OFF'}</strong>
          </button>

          {/* Conversational Auto-Reply Loop */}
          <button
            onClick={() => setConversationalMode(!conversationalMode)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono transition-colors ${
              conversationalMode
                ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400'
                : 'border-white/10 bg-white/5 text-nero-muted hover:text-white'
            }`}
            title="Continuous conversational hands-free dialogue"
          >
            <span>💬</span>
            <span>Dialogue Loop:</span>
            <strong className="uppercase">{conversationalMode ? 'ACTIVE' : 'OFF'}</strong>
          </button>

          {/* Wake Word Badge */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/10 bg-white/5">
            <span className="text-xs text-nero-muted font-mono">Wake-Word:</span>
            <span className="text-xs text-nero-cyan font-semibold font-mono">"NERO"</span>
            <button
              onClick={() => setWakeWordEnabled(!wakeWordEnabled)}
              className={`text-[10px] px-2 py-0.5 rounded font-medium transition-colors ${
                wakeWordEnabled
                  ? 'bg-nero-success/20 text-nero-success border border-nero-success/30'
                  : 'bg-white/10 text-nero-muted hover:text-white'
              }`}
            >
              {wakeWordEnabled ? 'Active' : 'Disabled'}
            </button>
          </div>
        </div>
      </div>

      {/* TTS Diagnostics Alert */}
      {ttsError && (
        <div className="mt-4 p-3 rounded-xl border border-rose-500/40 bg-rose-950/30 text-rose-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>⚠️</span>
            <span><strong>Voice Synthesis Warning:</strong> {ttsError}</span>
          </div>
          <span className="text-[10px] text-rose-400 font-mono">Check Settings -&gt; Voice</span>
        </div>
      )}

      {/* Main Interactive Centerpiece */}
      <div className="flex-1 flex flex-col items-center justify-center my-8">
        <div className="relative flex items-center justify-center w-72 h-72">
          {/* Animated Glow Rings driven by audio level & state */}
          <motion.div
            className="absolute rounded-full border border-nero-cyan/20"
            animate={{
              width: isRecording ? `${200 + audioLevel * 0.8}px` : isSpeaking ? '240px' : '200px',
              height: isRecording ? `${200 + audioLevel * 0.8}px` : isSpeaking ? '240px' : '200px',
              opacity: isRecording ? 0.7 : isSpeaking ? 0.5 : 0.2,
              scale: isSpeaking ? [1, 1.06, 1] : 1,
            }}
            transition={{ duration: 1.2, repeat: isSpeaking ? Infinity : 0 }}
          />

          <motion.div
            className="absolute rounded-full border border-nero-cyan/40"
            animate={{
              width: isRecording ? `${160 + audioLevel * 0.5}px` : isSpeaking ? '180px' : '150px',
              height: isRecording ? `${160 + audioLevel * 0.5}px` : isSpeaking ? '180px' : '150px',
              opacity: isRecording ? 0.9 : 0.4,
            }}
          />

          {/* Core Visualizer Orb */}
          <motion.button
            onClick={handleToggleRecord}
            className={`w-36 h-36 rounded-full flex flex-col items-center justify-center cursor-pointer transition-all duration-300 shadow-2xl relative z-10 select-none ${
              isRecording
                ? isSpeechDetected
                  ? 'bg-gradient-to-tr from-cyan-500 to-emerald-400 text-black shadow-[0_0_60px_rgba(0,212,255,0.7)]'
                  : 'bg-gradient-to-tr from-amber-500 to-amber-300 text-black shadow-[0_0_50px_rgba(245,158,11,0.6)]'
                : isSpeaking
                ? 'bg-gradient-to-tr from-emerald-500 to-emerald-300 text-black shadow-[0_0_50px_rgba(16,185,129,0.6)]'
                : 'bg-gradient-to-tr from-nero-blue to-nero-cyan text-white shadow-[0_0_40px_rgba(0,212,255,0.4)] hover:shadow-[0_0_60px_rgba(0,212,255,0.7)]'
            }`}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            {isRecording ? (
              <>
                <motion.div
                  className="w-8 h-8 rounded-md bg-black mb-1 flex items-center justify-center"
                  animate={{ scale: isSpeechDetected ? [1, 1.15, 1] : [1, 0.9, 1] }}
                  transition={{ repeat: Infinity, duration: isSpeechDetected ? 0.6 : 1 }}
                >
                  {isSpeechDetected && <div className="w-2.5 h-2.5 rounded-full bg-cyan-400" />}
                </motion.div>
                <span className="text-[11px] font-bold tracking-wider uppercase">
                  {isSpeechDetected ? 'Speaking' : 'Listening'}
                </span>
              </>
            ) : isSpeaking ? (
              <>
                <div className="flex items-center gap-1 mb-1">
                  {[0, 1, 2, 3].map((i) => (
                    <motion.div
                      key={i}
                      className="w-1.5 bg-black rounded-full"
                      animate={{ height: ['8px', '22px', '8px'] }}
                      transition={{ repeat: Infinity, duration: 0.6, delay: i * 0.15 }}
                    />
                  ))}
                </div>
                <span className="text-[11px] font-bold tracking-wider uppercase">Speaking</span>
              </>
            ) : isProcessing || isAiThinking ? (
              <>
                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin mb-1" />
                <span className="text-[11px] font-semibold tracking-wider uppercase">
                  {isAiThinking ? 'Thinking' : 'Transcribing'}
                </span>
              </>
            ) : (
              <>
                <svg className="w-9 h-9 mb-1" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                  <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                </svg>
                <span className="text-[11px] font-bold tracking-wider uppercase">Push To Talk</span>
              </>
            )}
          </motion.button>
        </div>

        {/* Live VAD Activity & Silence Countdown Ring */}
        {isRecording && (
          <div className="flex flex-col items-center gap-2 mt-2 w-64">
            {/* Visual Indicators */}
            <div className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${
                  isSpeechDetected ? 'bg-cyan-400 animate-pulse' : 'bg-amber-400'
                }`}
              />
              <span className="text-xs font-mono font-medium text-nero-text">
                {isSpeechDetected
                  ? vadStatus === 'silence_counting'
                    ? `Pause detected (${Math.round((1 - silenceProgress) * silenceTimeoutMs)}ms)`
                    : 'Voice active — Listening...'
                  : 'Waiting for your speech...'}
              </span>
            </div>

            {/* Silence countdown progress bar */}
            {vadStatus === 'silence_counting' && (
              <div className="w-full bg-black/50 h-1.5 rounded-full overflow-hidden border border-white/10">
                <div
                  className="bg-cyan-400 h-full rounded-full transition-all duration-75"
                  style={{ width: `${silenceProgress * 100}%` }}
                />
              </div>
            )}
          </div>
        )}

        {/* Contextual State Label */}
        <p className="text-xs font-mono text-nero-muted mt-3 text-center max-w-md">
          {isRecording
            ? smartListeningEnabled
              ? 'Speak naturally — NERO will automatically detect when you finish and respond'
              : 'Speaking to NERO... click orb to finish'
            : isSpeaking
            ? 'Synthesizing voice response...'
            : isProcessing
            ? 'Transcribing speech with Whisper...'
            : isAiThinking
            ? 'Processing thoughts with AI model...'
            : 'Click orb or use hotkey to begin speaking'}
        </p>

        {/* Controls during active states */}
        <div className="flex items-center gap-2 mt-3">
          {isRecording && (
            <>
              <Button variant="secondary" size="sm" onClick={() => void handleProcessSpeech()}>
                Finish Speaking Now
              </Button>
              <Button variant="danger" size="sm" onClick={handleCancelRecord}>
                Cancel
              </Button>
            </>
          )}

          {isSpeaking && (
            <Button
              variant="danger"
              size="sm"
              onClick={() => voiceService.stopSpeaking()}
            >
              Stop Audio Playback
            </Button>
          )}
        </div>
      </div>

      {/* Transcribed Speech & Controls Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Real-time Transcription Transcript */}
        <Card className="flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-nero-border mb-3">
            <span className="text-xs font-semibold text-nero-text uppercase tracking-wider font-mono">
              Speech Transcript
            </span>
            <span className="text-[10px] text-nero-muted font-mono">Whisper STT</span>
          </div>

          <div className="flex-1 min-h-[90px] p-3 rounded-lg bg-black/40 border border-white/5 font-sans text-sm text-nero-text flex flex-col justify-between">
            {transcribedText ? (
              <p className="leading-relaxed">{transcribedText}</p>
            ) : (
              <p className="text-nero-muted/50 italic text-xs">
                Your transcribed speech will appear here automatically when you speak...
              </p>
            )}

            {aiResponse && (
              <div className="mt-3 pt-3 border-t border-white/5 text-xs text-nero-cyan">
                <span className="font-mono text-[10px] uppercase text-nero-muted block mb-1">
                  NERO Response:
                </span>
                <p className="italic leading-relaxed">{aiResponse}</p>
              </div>
            )}
          </div>
        </Card>

        {/* TTS Voice Engine & Preview */}
        <Card className="flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-nero-border mb-3">
            <span className="text-xs font-semibold text-nero-text uppercase tracking-wider font-mono">
              Voice Generation Engine
            </span>
            <span className="text-[10px] text-nero-cyan font-mono">{ttsProvider.toUpperCase()}</span>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-[11px] text-nero-muted block mb-1">Active TTS Voice:</label>
              <select
                value={activeVoiceId}
                onChange={(e) => {
                  const val = e.target.value;
                  setActiveVoiceId(val);
                  const matched = voices.find((v) => v.id === val);
                  if (matched) setTtsProvider(matched.provider);
                }}
                className="w-full text-xs bg-nero-bg border border-nero-border rounded px-2.5 py-2 text-nero-text focus:outline-none focus:border-nero-cyan"
              >
                {voices.map((v) => (
                  <option key={v.id} value={v.id}>
                    [{v.provider.toUpperCase()}] {v.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Button
                variant="primary"
                size="sm"
                onClick={handleTestVoice}
                disabled={isSpeaking}
                className="w-full justify-center"
              >
                {isSpeaking ? 'Playing Audio...' : 'Preview Voice Audio'}
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
