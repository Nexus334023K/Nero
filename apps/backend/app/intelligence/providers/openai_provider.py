import json
import logging
from typing import Any, AsyncGenerator

import httpx

from app.core.config import settings
from app.intelligence.base import BaseAIProvider
from app.intelligence.providers.offline_provider import OfflineProvider

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
        self._offline_fallback = OfflineProvider()
        self._credit_balance_exhausted = False

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
        self._credit_balance_exhausted = False

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
        if self._credit_balance_exhausted and not api_key:
            return False
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
                    err_msg = ""
                    try:
                        err_json = response.json()
                        err_msg = err_json.get("error", {}).get("message", "")
                    except Exception:
                        pass

                    logger.warning("OpenAI returned status %d: %s", response.status_code, err_msg or response.text)
                    fallback_text = await self._offline_fallback.generate(
                        prompt, history=history, system_prompt=system_prompt, **kwargs
                    )

                    if response.status_code == 429:
                        self._credit_balance_exhausted = True
                        prefix = (
                            "> [!WARNING]\n"
                            "> **OpenAI Quota / Rate Limit Exceeded (429)**: Your OpenAI API key has exhausted its credit balance.\n"
                            "> *Add credits at [platform.openai.com/billing](https://platform.openai.com/settings/organization/billing/) or switch providers in Settings. NERO is operating via the built-in offline engine:*\n\n"
                        )
                    elif response.status_code == 401:
                        prefix = (
                            "> [!WARNING]\n"
                            "> **OpenAI Invalid Key (401)**: The OpenAI API key is invalid or revoked. Check Settings. NERO is operating via the offline engine:*\n\n"
                        )
                    else:
                        prefix = (
                            f"> [!WARNING]\n"
                            f"> **OpenAI Error ({response.status_code})**: {err_msg or 'Temporary API failure'}. Operating via offline engine:*\n\n"
                        )
                    return f"{prefix}{fallback_text}"

                data = response.json()
                choices = data.get("choices", [])
                if choices:
                    return choices[0].get("message", {}).get("content", "")
                return ""
        except Exception as e:
            logger.error("OpenAI request error: %s", e)
            fallback_text = await self._offline_fallback.generate(
                prompt, history=history, system_prompt=system_prompt, **kwargs
            )
            return (
                f"> [!WARNING]\n"
                f"> **OpenAI Connection Error**: {e}. Falling back to offline companion:\n\n"
                f"{fallback_text}"
            )

    async def generate_stream(
        self,
        prompt: str,
        history: list[dict[str, Any]] | None = None,
        system_prompt: str = "",
        **kwargs: Any,
    ) -> AsyncGenerator[str, None]:
        if not self.is_configured:
            async for chunk in self._offline_fallback.generate_stream(
                prompt, history=history, system_prompt=system_prompt, **kwargs
            ):
                yield chunk
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
                        err_body = await response.aread()
                        err_msg = ""
                        try:
                            err_json = json.loads(err_body.decode("utf-8"))
                            err_msg = err_json.get("error", {}).get("message", "")
                        except Exception:
                            pass

                        logger.warning("OpenAI stream status %d: %s", response.status_code, err_msg or err_body.decode("utf-8", errors="ignore"))

                        if response.status_code == 429:
                            self._credit_balance_exhausted = True
                            yield (
                                "> [!WARNING]\n"
                                "> **OpenAI Quota Exceeded (429)**: Your OpenAI account has exhausted its available credits.\n"
                                "> *Add credits at [platform.openai.com/billing](https://platform.openai.com/settings/organization/billing/) or switch providers in Settings. NERO is answering via local companion:*\n\n"
                            )
                        elif response.status_code == 401:
                            yield (
                                "> [!WARNING]\n"
                                "> **OpenAI Invalid Key (401)**: The OpenAI API key is invalid or revoked. Check Settings. NERO is answering via local companion:*\n\n"
                            )
                        else:
                            yield (
                                f"> [!WARNING]\n"
                                f"> **OpenAI Error ({response.status_code})**: {err_msg or 'Temporary API failure'}. Answering via local companion:*\n\n"
                            )

                        async for chunk in self._offline_fallback.generate_stream(
                            prompt, history=history, system_prompt=system_prompt, **kwargs
                        ):
                            yield chunk
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
            yield f"> [!WARNING]\n> **OpenAI Stream Error**: {e}. Falling back to offline companion:\n\n"
            async for chunk in self._offline_fallback.generate_stream(
                prompt, history=history, system_prompt=system_prompt, **kwargs
            ):
                yield chunk
