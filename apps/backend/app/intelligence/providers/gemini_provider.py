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
        model_name: str = "gemini-1.5-pro",
    ) -> None:
        self._api_key = api_key or settings.gemini_api_key or ""
        self._model_name = model_name

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
        return self._api_key or settings.gemini_api_key or ""

    def set_api_key(self, api_key: str) -> None:
        self._api_key = api_key

    def set_model(self, model_name: str) -> None:
        self._model_name = model_name

    async def check_health(self) -> bool:
        if not self.is_configured:
            return False
        key = self.get_api_key()
        url = f"{GEMINI_BASE_URL}/models?key={key}"
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                res = await client.get(url)
                return res.status_code == 200
        except Exception as e:
            logger.warning("Gemini health check failed: %s", e)
            return False

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
        url = f"{GEMINI_BASE_URL}/models/{self._model_name}:generateContent?key={key}"
        payload = self._build_payload(prompt, history, system_prompt)

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(url, json=payload)
                if response.status_code != 200:
                    logger.error("Gemini API error %d: %s", response.status_code, response.text)
                    return f"[Gemini Error {response.status_code}] Unable to complete request."
                data = response.json()
                candidates = data.get("candidates", [])
                if candidates:
                    parts = candidates[0].get("content", {}).get("parts", [])
                    if parts:
                        return parts[0].get("text", "")
                return ""
        except Exception as e:
            logger.error("Gemini request exception: %s", e)
            return f"[Gemini Fallback] Connection failed: {e}. Falling back to local offline mode."

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
        url = f"{GEMINI_BASE_URL}/models/{self._model_name}:streamGenerateContent?alt=sse&key={key}"
        payload = self._build_payload(prompt, history, system_prompt)

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                async with client.stream("POST", url, json=payload) as response:
                    if response.status_code != 200:
                        yield f"[Gemini Error {response.status_code}]"
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
            logger.error("Gemini streaming exception: %s", e)
            yield f"[Gemini Stream Error: {e}]"
