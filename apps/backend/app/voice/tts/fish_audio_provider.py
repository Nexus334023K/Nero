import os
from typing import AsyncGenerator, Optional

import httpx

from app.core.logging_config import get_logger
from app.voice.tts.base import BaseTTSProvider
from app.voice.tts.mock_provider import MockTTSProvider

logger = get_logger(__name__)


class FishAudioTTSProvider(BaseTTSProvider):
    """Fish Audio neural cloud TTS provider supporting streaming audio and custom voice models."""

    API_URL = "https://api.fish.audio/v1/tts"

    def __init__(
        self,
        api_key: Optional[str] = None,
        default_reference_id: Optional[str] = None,
    ):
        self.api_key = api_key or os.getenv("FISH_AUDIO_API_KEY", "")
        self.default_reference_id = default_reference_id or os.getenv(
            "FISH_AUDIO_REFERENCE_ID", ""
        )
        self._fallback = MockTTSProvider()

    @property
    def name(self) -> str:
        return "fish_audio"

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
            logger.info("Fish Audio API key not set, using fallback synthesizer.")
            return await self._fallback.synthesize(text, speed=speed)

        ref_id = voice_id or self.default_reference_id or "54f224d5500e482390f77977a41496d0"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "text": text,
            "reference_id": ref_id,
            "format": "mp3",
            "latency": "balanced",
            "normalize": True,
        }

        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                res = await client.post(self.API_URL, headers=headers, json=payload)
                if res.status_code == 200:
                    return res.content
                logger.warning(
                    f"Fish Audio API returned {res.status_code}: {res.text}. Falling back to mock audio."
                )
        except Exception as e:
            logger.warning(f"Fish Audio network error: {e}. Falling back to mock audio.")

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

        ref_id = voice_id or self.default_reference_id or "54f224d5500e482390f77977a41496d0"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "text": text,
            "reference_id": ref_id,
            "format": "mp3",
            "latency": "balanced",
            "normalize": True,
        }

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                async with client.stream("POST", self.API_URL, headers=headers, json=payload) as response:
                    if response.status_code == 200:
                        async for chunk in response.aiter_bytes(chunk_size=4096):
                            yield chunk
                        return
                    logger.warning(f"Fish Audio stream failed with status {response.status_code}")
        except Exception as e:
            logger.warning(f"Fish Audio streaming error: {e}")

        # Fallback stream
        async for chunk in self._fallback.synthesize_stream(text, speed=speed):
            yield chunk

    async def check_health(self) -> bool:
        if not self.is_configured:
            return False
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                res = await client.get(
                    "https://api.fish.audio/v1/model",
                    headers={"Authorization": f"Bearer {self.api_key}"},
                )
                return res.status_code in (200, 401)
        except Exception:
            return False
