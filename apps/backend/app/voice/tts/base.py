from abc import ABC, abstractmethod
from typing import AsyncGenerator, Optional


class BaseTTSProvider(ABC):
    @property
    @abstractmethod
    def name(self) -> str:
        """Name of the TTS provider."""
        ...

    @property
    @abstractmethod
    def is_configured(self) -> bool:
        """Whether the provider has necessary keys or files."""
        ...

    @property
    @abstractmethod
    def mime_type(self) -> str:
        """Content-Type of the generated audio (e.g. audio/wav or audio/mpeg)."""
        ...

    @abstractmethod
    async def synthesize(
        self,
        text: str,
        voice_id: Optional[str] = None,
        speed: float = 1.0,
    ) -> bytes:
        """Synthesize text into complete audio bytes."""
        ...

    @abstractmethod
    async def synthesize_stream(
        self,
        text: str,
        voice_id: Optional[str] = None,
        speed: float = 1.0,
    ) -> AsyncGenerator[bytes, None]:
        """Stream synthesized audio chunks."""
        ...

    @abstractmethod
    async def check_health(self) -> bool:
        """Check if the service is reachable and responsive."""
        ...
