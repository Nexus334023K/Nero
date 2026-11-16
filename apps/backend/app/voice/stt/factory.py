from typing import Dict
from app.voice.stt.base import BaseSTTProvider
from app.voice.stt.whisper_provider import WhisperSTTProvider


class STTFactory:
    _instances: Dict[str, BaseSTTProvider] = {}

    @classmethod
    def get_provider(cls, name: str = "whisper") -> BaseSTTProvider:
        if name not in cls._instances:
            cls._instances[name] = WhisperSTTProvider()
        return cls._instances[name]
