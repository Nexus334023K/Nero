import os
from typing import AsyncGenerator, Optional

import httpx

from app.core.logging_config import get_logger
from app.voice.tts.base import BaseTTSProvider
from app.voice.tts.mock_provider import MockTTSProvider

logger = get_logger(__name__)


class ElevenLabsTTSProvider(BaseTTSProvider):
    """ElevenLabs cloud TTS provider."""

    DEFAULT_VOICE = "21m00Tcm4TlvDq8ikWAM"  # Rachel default voice

    def __init__(
        self,
        api_key: Optional[str] = None,
        default_voice_id: Optional[str] = None,
    ):
        self.api_key = api_key or os.getenv("ELEVENLABS_API_KEY", "")
        self.default_voice_id = default_voice_id or os.getenv(
            "ELEVENLABS_VOICE_ID", self.DEFAULT_VOICE
        )
        self._fallback = MockTTSProvider()

    @property
    def name(self) -> str:
        return "elevenlabs"

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key)

    @property
    def mime_type(self) -> str:
        return "audio/mpeg" if self.is_configured else "audio/wav"

    async def synthesize(
        self,
        text: str,
        voice_id: Optional[str] = None,
        speed: float = 1.0,
    ) -> bytes:
        if not self.is_configured:
            return await self._fallback.synthesize(text, speed=speed)

        target_voice = voice_id or self.default_voice_id
        url = f"https://api.elevenlabs.io/v1/text-to-speech/{target_voice}"
        headers = {
            "xi-api-key": self.api_key,
            "Content-Type": "application/json",
        }
        payload = {
            "text": text,
            "model_id": "eleven_monolingual_v1",
            "voice_settings": {"stability": 0.5, "similarity_boost": 0.75},
        }

        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                res = await client.post(url, headers=headers, json=payload)
                if res.status_code == 200:
                    return res.content
        except Exception as e:
            logger.warning(f"ElevenLabs error: {e}")

        return await self._fallback.synthesize(text, speed=speed)

    async def synthesize_stream(
        self,
        text: str,
        voice_id: Optional[str] = None,
        speed: float = 1.0,
    ) -> AsyncGenerator[bytes, None]:
        if not self.is_configured:
            async for chunk in self._fallback.synthesize_stream(text, speed=speed):
                yield chunk
            return

        target_voice = voice_id or self.default_voice_id
        url = f"https://api.elevenlabs.io/v1/text-to-speech/{target_voice}/stream"
        headers = {
            "xi-api-key": self.api_key,
            "Content-Type": "application/json",
        }
        payload = {
            "text": text,
            "model_id": "eleven_monolingual_v1",
        }

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                async with client.stream("POST", url, headers=headers, json=payload) as res:
                    if res.status_code == 200:
                        async for chunk in res.aiter_bytes(chunk_size=4096):
                            yield chunk
                        return
        except Exception as e:
            logger.warning(f"ElevenLabs stream error: {e}")

        async for chunk in self._fallback.synthesize_stream(text, speed=speed):
            yield chunk

    async def check_health(self) -> bool:
        if not self.is_configured:
            return False
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                res = await client.get(
                    "https://api.elevenlabs.io/v1/voices",
                    headers={"xi-api-key": self.api_key},
                )
                return res.status_code in (200, 401)
        except Exception:
            return False
