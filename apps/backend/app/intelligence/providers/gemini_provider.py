import json
import logging
from typing import Any, AsyncGenerator

import httpx

from app.core.config import settings
from app.intelligence.base import BaseAIProvider

logger = logging.getLogger(__name__)

GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta"


class GeminiProvider(BaseAIProvider):
    """Google Gemini AI Provider utilizing the REST API."""

    def __init__(
        self,
        api_key: str | None = None,
        model_name: str = "gemini-flash-latest",
    ) -> None:
        self._api_key = api_key if api_key is not None else (settings.gemini_api_key or "")
        self._model_name = self._normalize_model(model_name)

    @property
    def name(self) -> str:
        return "gemini"

    @property
    def provider_type(self) -> str:
        return "cloud"

    @property
    def default_model(self) -> str:
        return self._model_name

    @property
    def is_configured(self) -> bool:
        key = self.get_api_key()
        return bool(key and key.strip() and not key.startswith("your_"))

    def get_api_key(self) -> str:
        return self._api_key if self._api_key is not None else (settings.gemini_api_key or "")

    def set_api_key(self, api_key: str) -> None:
        self._api_key = api_key

    def set_model(self, model_name: str) -> None:
        self._model_name = self._normalize_model(model_name)

    @staticmethod
    def _normalize_model(model_name: str) -> str:
        legacy_map = {
            "gemini-1.5-flash": "gemini-flash-lite-latest",
            "gemini-1.5-pro": "gemini-flash-lite-latest",
            "gemini-2.0-flash-exp": "gemini-flash-latest",
            "gemini-2.0-flash": "gemini-flash-latest",
            "gemini-2.5-flash": "gemini-flash-lite-latest",
        }
        return legacy_map.get(model_name, model_name)

    async def test_connection(
        self,
        api_key: str | None = None,
        model: str | None = None,
        base_url: str | None = None,
    ) -> tuple[bool, str]:
        key = (api_key or self.get_api_key() or "").strip()
        if not key or key.startswith("your_"):
            return False, "Gemini API key is missing or not configured."

        target_base = (base_url or GEMINI_BASE_URL).rstrip("/")
        url = f"{target_base}/models?key={key}"
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.get(url)
                if res.status_code == 200:
                    return True, "Connected successfully"
                elif res.status_code in (400, 403):
                    return False, f"Invalid Gemini API key (HTTP {res.status_code})"
                elif res.status_code == 429:
                    return False, "Gemini quota or rate limit exceeded (429)"
                else:
                    return False, f"Gemini error (HTTP {res.status_code})"
        except httpx.ConnectError:
            return False, "Unable to reach Gemini API (network unreachable)"
        except httpx.TimeoutException:
            return False, "Connection timed out"
        except Exception as e:
            logger.warning("Gemini health check failed: %s", e)
            return False, f"Connection error: {str(e)}"

    async def check_health(self, api_key: str | None = None) -> bool:
        ok, _ = await self.test_connection(api_key=api_key)
        return ok

    def _build_payload(
        self,
        prompt: str,
        history: list[dict[str, Any]] | None = None,
        system_prompt: str = "",
    ) -> dict[str, Any]:
        contents: list[dict[str, Any]] = []

        if history:
            for msg in history:
                role = "user" if msg.get("role") == "user" else "model"
                contents.append({
                    "role": role,
                    "parts": [{"text": str(msg.get("content", ""))}]
                })

        contents.append({
            "role": "user",
            "parts": [{"text": prompt}]
        })

        payload: dict[str, Any] = {"contents": contents}
        if system_prompt:
            payload["system_instruction"] = {
                "parts": [{"text": system_prompt}]
            }
        return payload

    async def generate(
        self,
        prompt: str,
        history: list[dict[str, Any]] | None = None,
        system_prompt: str = "",
        **kwargs: Any,
    ) -> str:
        if not self.is_configured:
            return (
                f"[Gemini - Offline Fallback] (API key not configured) "
                f"Response to: '{prompt}'. Please configure your Gemini API key in Settings."
            )

        key = self.get_api_key()
        model = self._normalize_model(self._model_name)
        url = f"{GEMINI_BASE_URL}/models/{model}:generateContent?key={key}"
        payload = self._build_payload(prompt, history, system_prompt)

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(url, json=payload)
                if response.status_code == 503 and model != "gemini-flash-lite-latest":
                    logger.info("Gemini model '%s' returned 503 high demand. Retrying with 'gemini-flash-lite-latest'...", model)
                    retry_url = f"{GEMINI_BASE_URL}/models/gemini-flash-lite-latest:generateContent?key={key}"
                    response = await client.post(retry_url, json=payload)

                if response.status_code == 200:
                    data = response.json()
                    candidates = data.get("candidates", [])
                    if candidates:
                        parts = candidates[0].get("content", {}).get("parts", [])
                        if parts:
                            return parts[0].get("text", "")
                    return ""
                logger.error("Gemini API error %d: %s", response.status_code, response.text)
                from app.intelligence.providers.offline_provider import OfflineProvider
                return await OfflineProvider().generate(prompt, history=history, system_prompt=system_prompt)
        except Exception as e:
            logger.error("Gemini request exception: %s. Using OfflineProvider companion fallback.", e)
            from app.intelligence.providers.offline_provider import OfflineProvider
            return await OfflineProvider().generate(prompt, history=history, system_prompt=system_prompt)

    async def generate_stream(
        self,
        prompt: str,
        history: list[dict[str, Any]] | None = None,
        system_prompt: str = "",
        **kwargs: Any,
    ) -> AsyncGenerator[str, None]:
        if not self.is_configured:
            fallback_text = (
                f"[Gemini - Offline Fallback] API key not configured. "
                f"Answering '{prompt}' via fallback."
            )
            for part in fallback_text.split(" "):
                yield part + " "
            return

        key = self.get_api_key()
        model = self._normalize_model(self._model_name)
        url = f"{GEMINI_BASE_URL}/models/{model}:streamGenerateContent?alt=sse&key={key}"
        payload = self._build_payload(prompt, history, system_prompt)

        try:
            async with httpx.AsyncClient(timeout=45.0) as client:
                async with client.stream("POST", url, json=payload) as response:
                    if response.status_code == 503 and model != "gemini-flash-lite-latest":
                        logger.info("Gemini stream 503 high demand on '%s'. Retrying stream with 'gemini-flash-lite-latest'...", model)
                        retry_url = f"{GEMINI_BASE_URL}/models/gemini-flash-lite-latest:streamGenerateContent?alt=sse&key={key}"
                        async with client.stream("POST", retry_url, json=payload) as retry_res:
                            if retry_res.status_code == 200:
                                async for line in retry_res.aiter_lines():
                                    line = line.strip()
                                    if line.startswith("data: "):
                                        try:
                                            chunk_data = json.loads(line[6:])
                                            candidates = chunk_data.get("candidates", [])
                                            if candidates:
                                                parts = candidates[0].get("content", {}).get("parts", [])
                                                for p in parts:
                                                    text = p.get("text", "")
                                                    if text:
                                                        yield text
                                        except Exception:
                                            continue
                                return

                    if response.status_code != 200:
                        logger.error("Gemini stream error %d, using offline provider fallback.", response.status_code)
                        from app.intelligence.providers.offline_provider import OfflineProvider
                        async for chunk in OfflineProvider().generate_stream(prompt, history=history, system_prompt=system_prompt):
                            yield chunk
                        return

                    async for line in response.aiter_lines():
                        line = line.strip()
                        if line.startswith("data: "):
                            raw_json = line[6:]
                            try:
                                chunk_data = json.loads(raw_json)
                                candidates = chunk_data.get("candidates", [])
                                if candidates:
                                    parts = candidates[0].get("content", {}).get("parts", [])
                                    for p in parts:
                                        text = p.get("text", "")
                                        if text:
                                            yield text
                            except Exception:
                                continue
        except Exception as e:
            logger.error("Gemini streaming exception: %s. Using offline provider fallback.", e)
            from app.intelligence.providers.offline_provider import OfflineProvider
            async for chunk in OfflineProvider().generate_stream(prompt, history=history, system_prompt=system_prompt):
                yield chunk
