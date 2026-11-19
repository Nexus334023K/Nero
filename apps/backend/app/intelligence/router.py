import time
from typing import Any

from app.core.config import settings
from app.core.logging_config import get_logger
from app.intelligence.base import BaseAIProvider
from app.intelligence.providers.gemini_provider import GeminiProvider
from app.intelligence.providers.offline_provider import OfflineProvider
from app.intelligence.providers.ollama_provider import OllamaProvider
from app.intelligence.providers.openai_provider import OpenAIProvider

logger = get_logger(__name__)


class AIRouter:
    """Intelligently routes AI requests to the optimal provider with automatic fallbacks."""

    def __init__(self) -> None:
        self.providers: dict[str, BaseAIProvider] = {
            "gemini": GeminiProvider(),
            "openai": OpenAIProvider(),
            "ollama": OllamaProvider(),
            "offline": OfflineProvider(),
        }
        self._active_provider_name = settings.active_ai_provider or "offline"

    def get_active_provider_name(self) -> str:
        return self._active_provider_name

    def set_active_provider(self, name: str) -> bool:
        provider_name = name.strip().lower()
        if provider_name in self.providers:
            self._active_provider_name = provider_name
            return True
        return False

    def get_provider(self, name: str) -> BaseAIProvider | None:
        return self.providers.get(name.strip().lower())

    async def select_provider(
        self,
        preferred: str | None = None,
        task_complexity: str = "normal",
    ) -> BaseAIProvider:
        """Selects the best available provider.

        Evaluates preferred provider first; if unavailable, attempts fallbacks in priority order:
        1. Preferred provider (if configured)
        2. Gemini (if configured)
        3. OpenAI (if configured)
        4. Ollama (if reachable)
        5. Offline (always available fallback)
        """
        target_name = (preferred or self._active_provider_name).strip().lower()
        chosen = self.providers.get(target_name)

        if chosen and chosen.is_configured:
            # If it's a cloud or local provider, verify health or trust config
            if target_name == "offline":
                return chosen
            healthy = await chosen.check_health()
            if healthy:
                return chosen
            logger.warning("Preferred provider '%s' failed health check, routing to fallback.", target_name)

        # Priority fallback chain
        fallback_order = ["gemini", "openai", "ollama", "offline"]
        for name in fallback_order:
            cand = self.providers.get(name)
            if cand and cand.is_configured:
                if name == "offline":
                    return cand
                if await cand.check_health():
                    return cand

        # Final guarantee
        return self.providers["offline"]

    async def list_providers(self) -> list[dict[str, Any]]:
        result = []
        for name, provider in self.providers.items():
            result.append({
                "name": name,
                "provider_type": provider.provider_type,
                "default_model": provider.default_model,
                "is_configured": provider.is_configured,
                "is_active": name == self._active_provider_name,
            })
        return result

    async def test_provider(
        self,
        name: str,
        api_key: str | None = None,
        model: str | None = None,
        base_url: str | None = None,
    ) -> dict[str, Any]:
        provider = self.get_provider(name)
        if not provider:
            return {
                "name": name,
                "success": False,
                "available": False,
                "error": f"Unknown provider: {name}",
                "message": f"Unknown provider: {name}",
            }

        start = time.time()
        try:
            if hasattr(provider, "test_connection"):
                available, message = await provider.test_connection(
                    api_key=api_key, model=model, base_url=base_url
                )
            else:
                available = await provider.check_health()
                message = "Connected successfully" if available else "Connection failed"

            latency_ms = round((time.time() - start) * 1000, 2)
            is_configured = bool(api_key and api_key.strip()) or provider.is_configured

            return {
                "name": name,
                "success": available,
                "available": available,
                "latency_ms": latency_ms,
                "is_configured": is_configured,
                "message": message,
            }
        except Exception as e:
            latency_ms = round((time.time() - start) * 1000, 2)
            return {
                "name": name,
                "success": False,
                "available": False,
                "latency_ms": latency_ms,
                "error": str(e),
                "message": str(e) or "Connection failed",
            }


ai_router = AIRouter()
