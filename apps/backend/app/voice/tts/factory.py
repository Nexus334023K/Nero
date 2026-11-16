from typing import Dict, Optional

from app.voice.tts.base import BaseTTSProvider
from app.voice.tts.elevenlabs_provider import ElevenLabsTTSProvider
from app.voice.tts.fish_audio_provider import FishAudioTTSProvider
from app.voice.tts.mock_provider import MockTTSProvider
from app.voice.tts.piper_provider import PiperTTSProvider


class TTSFactory:
    _instances: Dict[str, BaseTTSProvider] = {}

    @classmethod
    def get_provider(
        cls,
        name: str = "mock",
        fish_audio_api_key: Optional[str] = None,
        fish_audio_reference_id: Optional[str] = None,
        elevenlabs_api_key: Optional[str] = None,
        elevenlabs_voice_id: Optional[str] = None,
        piper_voice: str = "en_US-lessac-medium",
    ) -> BaseTTSProvider:
        key = f"{name}:{fish_audio_api_key}:{elevenlabs_api_key}:{piper_voice}"
        if key in cls._instances:
            return cls._instances[key]

        provider: BaseTTSProvider
        if name == "fish_audio":
            provider = FishAudioTTSProvider(
                api_key=fish_audio_api_key,
                default_reference_id=fish_audio_reference_id,
            )
        elif name == "elevenlabs":
            provider = ElevenLabsTTSProvider(
                api_key=elevenlabs_api_key,
                default_voice_id=elevenlabs_voice_id,
            )
        elif name == "piper":
            provider = PiperTTSProvider(voice_model=piper_voice)
        else:
            provider = MockTTSProvider()

        cls._instances[key] = provider
        return provider

    @classmethod
    def list_voices(cls) -> list[dict]:
        return [
            # Fish Audio voices
            {
                "id": "54f224d5500e482390f77977a41496d0",
                "name": "Fish Audio Natural (Default)",
                "provider": "fish_audio",
                "language": "en",
                "description": "Expressive, latency-optimized neural conversational voice",
            },
            {
                "id": "fish_audio_custom",
                "name": "Custom Reference Voice (Clone)",
                "provider": "fish_audio",
                "language": "en",
                "description": "User-specified Fish Audio voice clone reference ID",
            },
            # Piper local voices
            {
                "id": "en_US-lessac-medium",
                "name": "Piper Lessac (Local)",
                "provider": "piper",
                "language": "en-US",
                "description": "Clear and pleasant local voice",
            },
            {
                "id": "en_GB-alba-medium",
                "name": "Piper Alba (British)",
                "provider": "piper",
                "language": "en-GB",
                "description": "Local British accent voice",
            },
            # ElevenLabs voices
            {
                "id": "21m00Tcm4TlvDq8ikWAM",
                "name": "Rachel (ElevenLabs)",
                "provider": "elevenlabs",
                "language": "en",
                "description": "Calm and natural conversational female",
            },
            {
                "id": "mock_chime",
                "name": "Synthesized Harmonic Waveform (Offline)",
                "provider": "mock",
                "language": "en",
                "description": "Zero-dependency pure local harmonic audio",
            },
        ]
