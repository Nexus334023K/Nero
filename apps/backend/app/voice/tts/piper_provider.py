import shutil
import subprocess
from typing import AsyncGenerator, Optional

from app.core.logging_config import get_logger
from app.voice.tts.base import BaseTTSProvider
from app.voice.tts.mock_provider import MockTTSProvider

logger = get_logger(__name__)


class PiperTTSProvider(BaseTTSProvider):
    """Local Piper neural TTS engine."""

    def __init__(self, voice_model: str = "en_US-lessac-medium"):
        self.voice_model = voice_model
        self._fallback = MockTTSProvider()
        self._piper_path = shutil.which("piper")

    @property
    def name(self) -> str:
        return "piper"

    @property
    def is_configured(self) -> bool:
        return self._piper_path is not None

    @property
    def mime_type(self) -> str:
        return "audio/wav"

    async def synthesize(
        self,
        text: str,
        voice_id: Optional[str] = None,
        speed: float = 1.0,
    ) -> bytes:
        if not self.is_configured:
            return await self._fallback.synthesize(text, speed=speed)

        try:
            model = voice_id or self.voice_model
            # Execute piper binary
            process = subprocess.Popen(
                [self._piper_path, "--model", model, "--output-raw"],
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
            )
            raw_audio, stderr = process.communicate(input=text.encode("utf-8"), timeout=15)
            if process.returncode == 0 and raw_audio:
                return raw_audio
            logger.warning(f"Piper error: {stderr.decode('utf-8', errors='ignore')}")
        except Exception as e:
            logger.warning(f"Piper execution failed: {e}")

        return await self._fallback.synthesize(text, speed=speed)

    async def synthesize_stream(
        self,
        text: str,
        voice_id: Optional[str] = None,
        speed: float = 1.0,
    ) -> AsyncGenerator[bytes, None]:
        audio = await self.synthesize(text, voice_id=voice_id, speed=speed)
        chunk_size = 4096
        for i in range(0, len(audio), chunk_size):
            yield audio[i : i + chunk_size]

    async def check_health(self) -> bool:
        return self.is_configured
