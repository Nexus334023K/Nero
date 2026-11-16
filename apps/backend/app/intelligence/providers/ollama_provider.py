import json
import logging
from typing import Any, AsyncGenerator

import httpx

from app.core.config import settings
from app.intelligence.base import BaseAIProvider

logger = logging.getLogger(__name__)


class OllamaProvider(BaseAIProvider):
    """Local Ollama AI Provider."""

    def __init__(
        self,
        base_url: str | None = None,
        model_name: str = "llama3.2",
    ) -> None:
        self._base_url = (base_url or settings.ollama_base_url).rstrip("/")
        self._model_name = model_name

    @property
    def name(self) -> str:
        return "ollama"

    @property
    def provider_type(self) -> str:
        return "local"

    @property
    def default_model(self) -> str:
        return self._model_name

    @property
    def is_configured(self) -> bool:
        return bool(self._base_url)

    def set_base_url(self, base_url: str) -> None:
        self._base_url = base_url.rstrip("/")

    def set_model(self, model_name: str) -> None:
        self._model_name = model_name

    async def check_health(self) -> bool:
        url = f"{self._base_url}/api/tags"
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                res = await client.get(url)
                return res.status_code == 200
        except Exception:
            return False

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
        url = f"{self._base_url}/api/chat"
        payload = {
            "model": self._model_name,
            "messages": self._build_messages(prompt, history, system_prompt),
            "stream": False,
        }

        try:
            async with httpx.AsyncClient(timeout=45.0) as client:
                res = await client.post(url, json=payload)
                if res.status_code != 200:
                    return f"[Ollama Error {res.status_code}] Is model '{self._model_name}' pulled?"
                data = res.json()
                return data.get("message", {}).get("content", "")
        except Exception as e:
            logger.warning("Ollama connection failed: %s", e)
            return (
                f"[Ollama Fallback] Could not reach Ollama at {self._base_url}. "
                "Ensure Ollama is running (`ollama serve`)."
            )

    async def generate_stream(
        self,
        prompt: str,
        history: list[dict[str, Any]] | None = None,
        system_prompt: str = "",
        **kwargs: Any,
    ) -> AsyncGenerator[str, None]:
        url = f"{self._base_url}/api/chat"
        payload = {
            "model": self._model_name,
            "messages": self._build_messages(prompt, history, system_prompt),
            "stream": True,
        }

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                async with client.stream("POST", url, json=payload) as response:
                    if response.status_code != 200:
                        yield f"[Ollama Error {response.status_code}]"
                        return

                    async for line in response.aiter_lines():
                        line = line.strip()
                        if line:
                            try:
                                chunk = json.loads(line)
                                msg = chunk.get("message", {})
                                content = msg.get("content", "")
                                if content:
                                    yield content
                                if chunk.get("done", False):
                                    break
                            except Exception:
                                continue
        except Exception as e:
            logger.error("Ollama streaming error: %s", e)
            yield f"[Ollama Stream Error: {e}]"
