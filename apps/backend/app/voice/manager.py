import json
import os
from pathlib import Path
from typing import AsyncGenerator, Optional

from app.core.logging_config import get_logger
from app.voice.schemas import STTResponse, VoiceSettingsModel
from app.voice.stt.factory import STTFactory
from app.voice.tts.base import BaseTTSProvider
from app.voice.tts.factory import TTSFactory
from app.voice.wakeword.detector import WakeWordDetector

logger = get_logger(__name__)

CONFIG_PATH = Path("apps/backend/data/voice_settings.json")


class VoiceManager:
    """Central voice management service orchestrating STT, TTS, and Wake-word detection."""

    def __init__(self):
        self.settings = self._load_persisted_settings()
        self.wake_detector = WakeWordDetector(target_word=self.settings.wake_word)

    def _load_persisted_settings(self) -> VoiceSettingsModel:
        """Load persisted settings from disk or fall back to environment variables."""
        defaults = VoiceSettingsModel(
            tts_provider=os.getenv("NERO_TTS_PROVIDER", "mock"),
            stt_provider="whisper",
            wake_word_enabled=False,
            wake_word="nero",
            fish_audio_api_key=os.getenv("FISH_AUDIO_API_KEY", ""),
            fish_audio_reference_id=os.getenv("FISH_AUDIO_REFERENCE_ID", ""),
            fish_audio_model=os.getenv("FISH_AUDIO_MODEL", "s2.1-pro"),
            elevenlabs_api_key=os.getenv("ELEVENLABS_API_KEY", ""),
            elevenlabs_voice_id=os.getenv("ELEVENLABS_VOICE_ID", ""),
            piper_voice="en_US-lessac-medium",
            speed=1.0,
            allow_fallback=False,
        )

        if CONFIG_PATH.exists():
            try:
                raw = CONFIG_PATH.read_text(encoding="utf-8")
                data = json.loads(raw)
                # Overlay persisted values on defaults
                for k, v in data.items():
                    if hasattr(defaults, k) and v is not None:
                        setattr(defaults, k, v)
                logger.info(
                    "Loaded persisted voice settings: provider=%s, fish_key_set=%s, ref_id=%s",
                    defaults.tts_provider,
                    bool(defaults.fish_audio_api_key),
                    defaults.fish_audio_reference_id or "(none)",
                )
            except Exception as e:
                logger.warning("Error reading %s: %s", CONFIG_PATH, e)

        return defaults

    def _save_persisted_settings(self):
        """Save settings to disk so they survive backend restarts."""
        try:
            CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
            payload = self.settings.model_dump()
            CONFIG_PATH.write_text(json.dumps(payload, indent=2), encoding="utf-8")
            logger.info("Persisted voice settings to %s", CONFIG_PATH)
        except Exception as e:
            logger.error("Failed to persist voice settings: %s", e)

    def get_current_tts_provider(
        self,
        override_provider: Optional[str] = None,
        override_allow_fallback: Optional[bool] = None,
        override_model: Optional[str] = None,
    ) -> BaseTTSProvider:
        prov_name = override_provider or self.settings.tts_provider
        fallback = self.settings.allow_fallback if override_allow_fallback is None else override_allow_fallback
        model = override_model or self.settings.fish_audio_model

        return TTSFactory.get_provider(
            name=prov_name,
            fish_audio_api_key=self.settings.fish_audio_api_key,
            fish_audio_reference_id=self.settings.fish_audio_reference_id,
            fish_audio_model=model,
            elevenlabs_api_key=self.settings.elevenlabs_api_key,
            elevenlabs_voice_id=self.settings.elevenlabs_voice_id,
            piper_voice=self.settings.piper_voice,
            allow_fallback=fallback,
        )

    async def synthesize(
        self,
        text: str,
        provider: Optional[str] = None,
        voice_id: Optional[str] = None,
        speed: Optional[float] = None,
        allow_fallback: Optional[bool] = None,
        model: Optional[str] = None,
    ) -> tuple[bytes, str]:
        """Synthesize text and return (audio_bytes, mime_type)."""
        tts = self.get_current_tts_provider(
            override_provider=provider,
            override_allow_fallback=allow_fallback,
            override_model=model,
        )
        target_speed = speed or self.settings.speed
        audio_bytes = await tts.synthesize(text, voice_id=voice_id, speed=target_speed)
        return audio_bytes, tts.mime_type

    async def synthesize_stream(
        self,
        text: str,
        provider: Optional[str] = None,
        voice_id: Optional[str] = None,
        speed: Optional[float] = None,
        allow_fallback: Optional[bool] = None,
        model: Optional[str] = None,
    ) -> tuple[AsyncGenerator[bytes, None], str]:
        """Synthesize text and yield audio chunks."""
        tts = self.get_current_tts_provider(
            override_provider=provider,
            override_allow_fallback=allow_fallback,
            override_model=model,
        )
        target_speed = speed or self.settings.speed
        stream = tts.synthesize_stream(text, voice_id=voice_id, speed=target_speed)
        return stream, tts.mime_type

    async def transcribe(self, audio_bytes: bytes, filename: str = "recording.wav") -> STTResponse:
        stt = STTFactory.get_provider(self.settings.stt_provider)
        res = await stt.transcribe(audio_bytes, filename=filename)
        return res

    def update_settings(self, new_settings: VoiceSettingsModel) -> VoiceSettingsModel:
        self.settings = new_settings
        self.wake_detector.target_word = new_settings.wake_word
        self._save_persisted_settings()
        TTSFactory.clear_cache()
        logger.info(
            "Updated voice settings: provider=%s, fish_key_set=%s, ref_id=%s, allow_fallback=%s",
            new_settings.tts_provider,
            bool(new_settings.fish_audio_api_key),
            new_settings.fish_audio_reference_id or "(none)",
            new_settings.allow_fallback,
        )
        return self.settings


voice_manager = VoiceManager()
