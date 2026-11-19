import os
from typing import AsyncGenerator, Optional

import httpx

from app.core.logging_config import get_logger
from app.voice.tts.base import BaseTTSProvider
from app.voice.tts.mock_provider import MockTTSProvider

logger = get_logger(__name__)


class FishAudioError(Exception):
    """Exception raised when Fish Audio TTS synthesis fails."""

    def __init__(self, status_code: int, message: str, sanitized_details: Optional[str] = None):
        super().__init__(message)
        self.status_code = status_code
        self.provider = "fish_audio"
        self.message = message
        self.sanitized_details = sanitized_details or message

    def __str__(self) -> str:
        return f"[Fish Audio {self.status_code}]: {self.message}"


class FishAudioTTSProvider(BaseTTSProvider):
    """Fish Audio neural cloud TTS provider supporting streaming audio,

    custom voice reference models, and official v1 REST API.
    """

    API_URL = "https://api.fish.audio/v1/tts"
    DEFAULT_MODEL = "s2.1-pro-free"
    DEFAULT_REFERENCE_ID = "54f224d5500e482390f77977a41496d0"

    def __init__(
        self,
        api_key: Optional[str] = None,
        default_reference_id: Optional[str] = None,
        model: Optional[str] = None,
        allow_fallback: bool = False,
    ):
        self.api_key = (api_key or os.getenv("FISH_AUDIO_API_KEY", "")).strip()
        self.default_reference_id = (
            default_reference_id or os.getenv("FISH_AUDIO_REFERENCE_ID", "")
        ).strip()
        self.model = (model or os.getenv("FISH_AUDIO_MODEL", self.DEFAULT_MODEL)).strip()
        self.allow_fallback = allow_fallback
        self._fallback = MockTTSProvider()

    @property
    def name(self) -> str:
        return "fish_audio"

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key)

    @property
    def mime_type(self) -> str:
        return "audio/mpeg"

    def _sanitize(self, text: str) -> str:
        """Strip raw API keys from log strings to protect secrets."""
        if not self.api_key or len(self.api_key) < 4:
            return text
        return text.replace(self.api_key, "[REDACTED_API_KEY]")

    def _resolve_reference_id(self, voice_id: Optional[str]) -> str:
        ref = (voice_id or self.default_reference_id or self.DEFAULT_REFERENCE_ID).strip()
        # If client passes pseudo-ids like 'fish_audio_custom' or 'fish_audio'
        if ref in ("fish_audio_custom", "fish_audio", "default", ""):
            ref = self.default_reference_id or self.DEFAULT_REFERENCE_ID
        return ref

    def _build_headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "model": self.model,
        }

    def _build_payload(self, text: str, ref_id: str) -> dict:
        payload = {
            "text": text,
            "format": "mp3",
            "normalize": True,
        }
        if ref_id:
            payload["reference_id"] = ref_id
        return payload

    async def synthesize(
        self,
        text: str,
        voice_id: Optional[str] = None,
        speed: float = 1.0,
    ) -> bytes:
        ref_id = self._resolve_reference_id(voice_id)

        # 1. Validation check
        if not self.is_configured:
            logger.warning("[TTS] Provider: Fish Audio | Error: API key not configured")
            if self.allow_fallback:
                logger.info("[TTS] Fallback enabled, using mock harmonic waveform")
                return await self._fallback.synthesize(text, speed=speed)
            raise FishAudioError(
                status_code=400,
                message="Fish Audio API key is not configured. Please add your API key in Settings -> Voice.",
            )

        # 2. Diagnostic logging
        logger.info("[TTS] Provider: Fish Audio")
        logger.info("[TTS] Voice ID configured: %s (reference_id: %s)", bool(ref_id), ref_id)
        logger.info("[TTS] Model: %s", self.model)
        logger.info("[TTS] Request started | Text length: %d chars", len(text))

        headers = self._build_headers()
        payload = self._build_payload(text, ref_id)

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                res = await client.post(self.API_URL, headers=headers, json=payload)

                # Automatic retry on 402 if s2.1-pro requires paid credits and free tier is available
                if res.status_code == 402 and self.model != "s2.1-pro-free":
                    logger.info("[TTS] Model '%s' returned 402. Retrying with free model 's2.1-pro-free'...", self.model)
                    retry_headers = dict(headers)
                    retry_headers["model"] = "s2.1-pro-free"
                    res = await client.post(self.API_URL, headers=retry_headers, json=payload)
                    if res.status_code == 200:
                        self.model = "s2.1-pro-free"

            logger.info("[TTS] Response status: %d", res.status_code)
            content_type = res.headers.get("content-type", "audio/mpeg")
            logger.info("[TTS] Content type: %s", content_type)

            if res.status_code == 200:
                audio_bytes = res.content
                if not audio_bytes or len(audio_bytes) < 32:
                    logger.error("[TTS] Fish Audio returned empty audio: %d bytes", len(audio_bytes))
                    if self.allow_fallback:
                        return await self._fallback.synthesize(text, speed=speed)
                    raise FishAudioError(
                        status_code=502,
                        message="Fish Audio returned empty audio stream.",
                    )
                logger.info("[TTS] Audio bytes received: %d", len(audio_bytes))
                logger.info("[TTS] Playback started")
                return audio_bytes

            # HTTP Error Handling (sanitized, no secrets)
            raw_err = self._sanitize(res.text[:300])
            logger.error("[TTS] Fish Audio HTTP %d error: %s", res.status_code, raw_err)

            if self.allow_fallback:
                logger.warning("[TTS] Fallback enabled, using mock audio.")
                return await self._fallback.synthesize(text, speed=speed)

            if res.status_code == 401:
                msg = "Fish Audio authentication failed (401 Unauthorized). Please check your API key."
            elif res.status_code == 402:
                msg = "Fish Audio account balance exhausted or payment required (402). Check your Fish Audio credits."
            elif res.status_code == 422:
                msg = f"Fish Audio unprocessable entity (422). Check that reference_id '{ref_id}' is valid."
            else:
                msg = f"Fish Audio error (HTTP {res.status_code}): {raw_err}"

            raise FishAudioError(status_code=res.status_code, message=msg, sanitized_details=raw_err)

        except FishAudioError:
            raise
        except httpx.TimeoutException:
            logger.error("[TTS] Fish Audio request timed out after 30s")
            if self.allow_fallback:
                return await self._fallback.synthesize(text, speed=speed)
            raise FishAudioError(
                status_code=504,
                message="Fish Audio request timed out. Please check your internet connection.",
            )
        except Exception as e:
            sanitized_err = self._sanitize(str(e))
            logger.error("[TTS] Fish Audio network error: %s", sanitized_err)
            if self.allow_fallback:
                return await self._fallback.synthesize(text, speed=speed)
            raise FishAudioError(
                status_code=502,
                message=f"Fish Audio network error: {sanitized_err}",
            )

    async def synthesize_stream(
        self,
        text: str,
        voice_id: Optional[str] = None,
        speed: float = 1.0,
    ) -> AsyncGenerator[bytes, None]:
        """Synthesize text and yield audio chunks.

        Raises FishAudioError if synthesis fails unless allow_fallback is True.
        """
        ref_id = self._resolve_reference_id(voice_id)

        if not self.is_configured:
            logger.warning("[TTS] Provider: Fish Audio | Error: API key not configured")
            if self.allow_fallback:
                async for chunk in self._fallback.synthesize_stream(text, speed=speed):
                    yield chunk
                return
            raise FishAudioError(
                status_code=400,
                message="Fish Audio API key is not configured. Please add your API key in Settings -> Voice.",
            )

        logger.info("[TTS] Provider: Fish Audio (streaming)")
        logger.info("[TTS] Voice ID configured: %s (reference_id: %s)", bool(ref_id), ref_id)
        logger.info("[TTS] Model: %s", self.model)
        logger.info("[TTS] Request started")

        headers = self._build_headers()
        payload = self._build_payload(text, ref_id)

        try:
            client = httpx.AsyncClient(timeout=30.0)
            async with client:
                async with client.stream("POST", self.API_URL, headers=headers, json=payload) as response:
                    # Automatic retry on 402 if s2.1-pro requires paid credits
                    if response.status_code == 402 and self.model != "s2.1-pro-free":
                        logger.info("[TTS] Streaming with '%s' returned 402. Retrying with 's2.1-pro-free'...", self.model)
                        retry_headers = dict(headers)
                        retry_headers["model"] = "s2.1-pro-free"
                        async with client.stream("POST", self.API_URL, headers=retry_headers, json=payload) as retry_response:
                            if retry_response.status_code == 200:
                                self.model = "s2.1-pro-free"
                                total_bytes = 0
                                async for chunk in retry_response.aiter_bytes(chunk_size=4096):
                                    total_bytes += len(chunk)
                                    yield chunk
                                logger.info("[TTS] Audio bytes received (stream retry): %d", total_bytes)
                                logger.info("[TTS] Playback started")
                                return

                    logger.info("[TTS] Response status: %d", response.status_code)
                    if response.status_code == 200:
                        total_bytes = 0
                        async for chunk in response.aiter_bytes(chunk_size=4096):
                            total_bytes += len(chunk)
                            yield chunk
                        logger.info("[TTS] Audio bytes received: %d", total_bytes)
                        logger.info("[TTS] Playback started")
                        return

                    raw_bytes = await response.aread()
                    err_text = self._sanitize(raw_bytes.decode(errors="replace"))
                    logger.error("[TTS] Fish Audio stream failed with HTTP %d: %s", response.status_code, err_text[:200])

                    if self.allow_fallback:
                        logger.warning("[TTS] Fallback stream activated")
                        async for chunk in self._fallback.synthesize_stream(text, speed=speed):
                            yield chunk
                        return

                    if response.status_code == 401:
                        msg = "Fish Audio authentication failed (401 Unauthorized)."
                    elif response.status_code == 402:
                        msg = "Fish Audio payment required or credits exhausted (402)."
                    elif response.status_code == 422:
                        msg = f"Fish Audio unprocessable entity (422). Check reference_id '{ref_id}'."
                    else:
                        msg = f"Fish Audio streaming error (HTTP {response.status_code})"

                    raise FishAudioError(status_code=response.status_code, message=msg)

        except FishAudioError:
            raise
        except Exception as e:
            sanitized_err = self._sanitize(str(e))
            logger.error("[TTS] Fish Audio streaming error: %s", sanitized_err)
            if self.allow_fallback:
                async for chunk in self._fallback.synthesize_stream(text, speed=speed):
                    yield chunk
                return
            raise FishAudioError(
                status_code=502,
                message=f"Fish Audio streaming connection error: {sanitized_err}",
            )

    async def check_health(self) -> bool:
        if not self.is_configured:
            return False
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                res = await client.get(
                    "https://api.fish.audio/v1/model",
                    headers={"Authorization": f"Bearer {self.api_key}"},
                )
                return res.status_code == 200
        except Exception:
            return False
