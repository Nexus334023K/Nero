from typing import Optional
from pydantic import BaseModel, Field


class TTSRequest(BaseModel):
    text: str
    provider: Optional[str] = None  # "fish_audio" | "piper" | "elevenlabs" | "mock"
    voice_id: Optional[str] = None
    speed: float = Field(default=1.0, ge=0.5, le=2.0)


class STTResponse(BaseModel):
    text: str
    confidence: float = 1.0
    language: str = "en"
    duration_seconds: float = 0.0


class VoiceSettingsModel(BaseModel):
    tts_provider: str = "mock"  # "fish_audio", "piper", "elevenlabs", "mock"
    stt_provider: str = "whisper"
    wake_word_enabled: bool = False
    wake_word: str = "nero"
    fish_audio_api_key: Optional[str] = None
    fish_audio_reference_id: Optional[str] = None  # Custom voice model id
    elevenlabs_api_key: Optional[str] = None
    elevenlabs_voice_id: Optional[str] = None
    piper_voice: str = "en_US-lessac-medium"
    speed: float = 1.0


class VoiceInfo(BaseModel):
    id: str
    name: str
    provider: str
    language: str = "en"
    gender: Optional[str] = None
    description: Optional[str] = None
