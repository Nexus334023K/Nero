import json
import os
from typing import AsyncGenerator, Optional

from sqlalchemy import select

from app.core.logging_config import get_logger
from app.database.models import ActivityLog
from app.database.session import AsyncSessionLocal
from app.voice.schemas import STTResponse, VoiceSettingsModel
from app.voice.stt.factory import STTFactory
from app.voice.tts.base import BaseTTSProvider
from app.voice.tts.factory import TTSFactory
from app.voice.wakeword.detector import WakeWordDetector

logger = get_logger(__name__)


class VoiceManager:
    """Central voice management service orchestrating STT, TTS, and Wake-word detection."""

    def __init__(self):
        self.settings = VoiceSettingsModel(
            tts_provider=os.getenv("NERO_TTS_PROVIDER", "mock"),
            stt_provider="whisper",
            wake_word_enabled=False,
            wake_word="nero",
            fish_audio_api_key=os.getenv("FISH_AUDIO_API_KEY", ""),
            fish_audio_reference_id=os.getenv("FISH_AUDIO_REFERENCE_ID", ""),
            elevenlabs_api_key=os.getenv("ELEVENLABS_API_KEY", ""),
            elevenlabs_voice_id=os.getenv("ELEVENLABS_VOICE_ID", ""),
            piper_voice="en_US-lessac-medium",
            speed=1.0,
        )
        self.wake_detector = WakeWordDetector(target_word=self.settings.wake_word)

    def get_current_tts_provider(self, override_provider: Optional[str] = None) -> BaseTTSProvider:
        prov_name = override_provider or self.settings.tts_provider
        return TTSFactory.get_provider(
            name=prov_name,
            fish_audio_api_key=self.settings.fish_audio_api_key,
            fish_audio_reference_id=self.settings.fish_audio_reference_id,
            elevenlabs_api_key=self.settings.elevenlabs_api_key,
            elevenlabs_voice_id=self.settings.elevenlabs_voice_id,
            piper_voice=self.settings.piper_voice,
        )

    async def synthesize(
        self,
        text: str,
        provider: Optional[str] = None,
        voice_id: Optional[str] = None,
        speed: Optional[float] = None,
    ) -> tuple[bytes, str]:
        """Synthesize text and return (audio_bytes, mime_type)."""
        tts = self.get_current_tts_provider(provider)
        target_speed = speed or self.settings.speed
        audio_bytes = await tts.synthesize(text, voice_id=voice_id, speed=target_speed)
        return audio_bytes, tts.mime_type

    async def synthesize_stream(
        self,
        text: str,
        provider: Optional[str] = None,
        voice_id: Optional[str] = None,
        speed: Optional[float] = None,
    ) -> tuple[AsyncGenerator[bytes, None], str]:
        """Synthesize text and yield audio chunks."""
        tts = self.get_current_tts_provider(provider)
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
        return self.settings


voice_manager = VoiceManager()
