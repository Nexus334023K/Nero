from abc import ABC, abstractmethod
from app.voice.schemas import STTResponse


class BaseSTTProvider(ABC):
    @property
    @abstractmethod
    def name(self) -> str:
        ...

    @property
    @abstractmethod
    def is_configured(self) -> bool:
        ...

    @abstractmethod
    async def transcribe(self, audio_bytes: bytes, filename: str = "audio.wav") -> STTResponse:
        ...

    @abstractmethod
    async def check_health(self) -> bool:
        ...
