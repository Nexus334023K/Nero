import json
import logging
from typing import Any, AsyncGenerator

import httpx

from app.core.config import settings
from app.intelligence.base import BaseAIProvider

logger = logging.getLogger(__name__)

OPENAI_BASE_URL = "https://api.openai.com/v1"


class OpenAIProvider(BaseAIProvider):
    """OpenAI AI Provider utilizing the Chat Completions API."""

    def __init__(
        self,
        api_key: str | None = None,
        model_name: str = "gpt-4o",
    ) -> None:
        self._api_key = api_key
        self._model_name = model_name

    @property
    def name(self) -> str:
        return "openai"

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
        return self._api_key if self._api_key is not None else (settings.openai_api_key or "")

    def set_api_key(self, api_key: str) -> None:
        self._api_key = api_key

    def set_model(self, model_name: str) -> None:
        self._model_name = model_name

    async def test_connection(
        self,
        api_key: str | None = None,
        model: str | None = None,
        base_url: str | None = None,
    ) -> tuple[bool, str]:
        key = (api_key or self.get_api_key() or "").strip()
        if not key or key.startswith("your_"):
            return False, "API key is missing or not configured."

        target_base = (base_url or OPENAI_BASE_URL).rstrip("/")
        headers = {"Authorization": f"Bearer {key}"}
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.get(f"{target_base}/models", headers=headers)
                if res.status_code == 200:
                    return True, "Connected successfully"
                elif res.status_code == 401:
                    return False, "Invalid API key (401 Unauthorized)"
                elif res.status_code == 429:
                    return False, "OpenAI rate limit or quota exceeded (429)"
                else:
                    return False, f"OpenAI error (HTTP {res.status_code})"
        except httpx.ConnectError:
            return False, "Unable to reach OpenAI API (network unreachable)"
        except httpx.TimeoutException:
            return False, "Connection timed out"
        except Exception as e:
            logger.warning("OpenAI health check failed: %s", e)
            return False, f"Connection error: {str(e)}"

    async def check_health(self, api_key: str | None = None) -> bool:
        ok, _ = await self.test_connection(api_key=api_key)
        return ok

    def _build_messages(
        self,
        prompt: str,
        history: list[dict[str, Any]] | None = None,
        system_prompt: str = "",
    ) -> list[dict[str, str]]:
        messages: list[dict[str, str]] = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})

        if history:
            for msg in history:
                messages.append({
                    "role": msg.get("role", "user"),
                    "content": str(msg.get("content", "")),
                })

        messages.append({"role": "user", "content": prompt})
        return messages

    async def generate(
        self,
        prompt: str,
        history: list[dict[str, Any]] | None = None,
        system_prompt: str = "",
        **kwargs: Any,
    ) -> str:
        if not self.is_configured:
            return (
                f"[OpenAI - Offline Fallback] (API key not configured) "
                f"Response to: '{prompt}'. Configure OpenAI API key in Settings."
            )

        key = self.get_api_key()
        headers = {
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": self._model_name,
            "messages": self._build_messages(prompt, history, system_prompt),
        }

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{OPENAI_BASE_URL}/chat/completions",
                    headers=headers,
                    json=payload,
                )
                if response.status_code != 200:
                    logger.error("OpenAI error %d: %s", response.status_code, response.text)
                    return f"[OpenAI Error {response.status_code}] Unable to complete request."
                data = response.json()
                choices = data.get("choices", [])
                if choices:
                    return choices[0].get("message", {}).get("content", "")
                return ""
        except Exception as e:
            logger.error("OpenAI request error: %s", e)
            return f"[OpenAI Fallback] Connection error: {e}"

    async def generate_stream(
        self,
        prompt: str,
        history: list[dict[str, Any]] | None = None,
        system_prompt: str = "",
        **kwargs: Any,
    ) -> AsyncGenerator[str, None]:
        if not self.is_configured:
            fallback = f"[OpenAI - Offline Fallback] Key not configured. Answering '{prompt}'."
            for part in fallback.split(" "):
                yield part + " "
            return

        key = self.get_api_key()
        headers = {
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": self._model_name,
            "messages": self._build_messages(prompt, history, system_prompt),
            "stream": True,
        }

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                async with client.stream(
                    "POST",
                    f"{OPENAI_BASE_URL}/chat/completions",
                    headers=headers,
                    json=payload,
                ) as response:
                    if response.status_code != 200:
                        yield f"[OpenAI Error {response.status_code}]"
                        return

                    async for line in response.aiter_lines():
                        line = line.strip()
                        if line.startswith("data: "):
                            raw = line[6:]
                            if raw == "[DONE]":
                                break
                            try:
                                chunk = json.loads(raw)
                                choices = chunk.get("choices", [])
                                if choices:
                                    delta = choices[0].get("delta", {})
                                    content = delta.get("content", "")
                                    if content:
                                        yield content
                            except Exception:
                                continue
        except Exception as e:
            logger.error("OpenAI stream error: %s", e)
            yield f"[OpenAI Stream Error: {e}]"
