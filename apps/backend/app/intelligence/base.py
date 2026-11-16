from abc import ABC, abstractmethod
from typing import Any, AsyncGenerator


class BaseAIProvider(ABC):
    """Abstract base class for all AI intelligence providers in NERO."""

    @property
    @abstractmethod
    def name(self) -> str:
        """Provider identifier (e.g. 'gemini', 'openai', 'ollama', 'offline')."""
        pass

    @property
    @abstractmethod
    def provider_type(self) -> str:
        """Type of provider: 'cloud' or 'local'."""
        pass

    @property
    @abstractmethod
    def default_model(self) -> str:
        """Default model name."""
        pass

    @property
    @abstractmethod
    def is_configured(self) -> bool:
        """Whether the provider has necessary credentials / configuration."""
        pass

    @abstractmethod
    async def generate(
        self,
        prompt: str,
        history: list[dict[str, Any]] | None = None,
        system_prompt: str = "",
        **kwargs: Any,
    ) -> str:
        """Generate a complete text response."""
        pass

    @abstractmethod
    async def generate_stream(
        self,
        prompt: str,
        history: list[dict[str, Any]] | None = None,
        system_prompt: str = "",
        **kwargs: Any,
    ) -> AsyncGenerator[str, None]:
        """Stream response tokens as an async generator."""
        pass

    @abstractmethod
    async def check_health(self) -> bool:
        """Verify provider availability and connectivity."""
        pass
