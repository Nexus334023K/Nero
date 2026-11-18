from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import Response

from app.core.logging_config import get_logger
from app.voice.manager import voice_manager
from app.voice.schemas import (
    STTResponse,
    TTSRequest,
    VoiceSettingsModel,
    VoiceTestRequest,
    VoiceTestResponse,
)
from app.voice.tts.factory import TTSFactory
from app.voice.tts.fish_audio_provider import FishAudioError, FishAudioTTSProvider

logger = get_logger(__name__)

router = APIRouter(prefix="/voice", tags=["voice"])


@router.post("/tts")
async def text_to_speech(req: TTSRequest):
    """Synthesize text into speech audio bytes using the active or requested TTS provider."""
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")

    try:
        audio_bytes, mime_type = await voice_manager.synthesize(
            text=req.text,
            provider=req.provider,
            voice_id=req.voice_id,
            speed=req.speed,
            allow_fallback=req.allow_fallback,
            model=req.model,
        )

        return Response(
            content=audio_bytes,
            media_type=mime_type,
            headers={
                "Content-Disposition": f'inline; filename="speech.{mime_type.split("/")[-1]}"',
                "Cache-Control": "no-cache",
                "Content-Length": str(len(audio_bytes)),
                "X-TTS-Provider": req.provider or voice_manager.settings.tts_provider,
            },
        )
    except FishAudioError as e:
        logger.error("[TTS API] Fish Audio error: %s (status: %d)", e.message, e.status_code)
        raise HTTPException(
            status_code=e.status_code if 400 <= e.status_code < 600 else 502,
            detail=e.message,
        )
    except Exception as e:
        logger.error("[TTS API] Synthesis error: %s", str(e))
        raise HTTPException(status_code=500, detail=f"TTS synthesis error: {str(e)}")


@router.post("/test", response_model=VoiceTestResponse)
async def test_voice_provider(req: VoiceTestRequest):
    """Test voice synthesis for a provider (e.g. Fish Audio) with live verification."""
    provider_name = (req.provider or "fish_audio").lower()

    if provider_name == "fish_audio":
        api_key = req.api_key or voice_manager.settings.fish_audio_api_key
        voice_id = req.voice_id or voice_manager.settings.fish_audio_reference_id
        model = req.model or voice_manager.settings.fish_audio_model

        if not api_key:
            return VoiceTestResponse(
                success=False,
                provider="fish_audio",
                message="Fish Audio API key is missing. Please enter your API key.",
                error="API_KEY_REQUIRED",
            )

        provider_inst = FishAudioTTSProvider(
            api_key=api_key,
            default_reference_id=voice_id,
            model=model,
            allow_fallback=False,
        )

        try:
            audio_bytes = await provider_inst.synthesize(req.text, voice_id=voice_id)
            return VoiceTestResponse(
                success=True,
                provider="fish_audio",
                message=f"Fish Audio synthesis verified successfully! Generated {len(audio_bytes)} audio bytes.",
                audio_size_bytes=len(audio_bytes),
                content_type=provider_inst.mime_type,
            )
        except FishAudioError as e:
            return VoiceTestResponse(
                success=False,
                provider="fish_audio",
                message=e.message,
                error=e.sanitized_details,
            )
        except Exception as e:
            return VoiceTestResponse(
                success=False,
                provider="fish_audio",
                message=f"Network error: {str(e)}",
                error=str(e),
            )
    else:
        try:
            audio_bytes, mime = await voice_manager.synthesize(
                req.text,
                provider=provider_name,
                voice_id=req.voice_id,
            )
            return VoiceTestResponse(
                success=True,
                provider=provider_name,
                message=f"Provider '{provider_name}' generated {len(audio_bytes)} bytes.",
                audio_size_bytes=len(audio_bytes),
                content_type=mime,
            )
        except Exception as e:
            return VoiceTestResponse(
                success=False,
                provider=provider_name,
                message=str(e),
                error=str(e),
            )


@router.post("/stt", response_model=STTResponse)
async def speech_to_text(file: UploadFile = File(...)):
    """Transcribe uploaded audio file to text."""
    try:
        content = await file.read()
        if not content:
            raise HTTPException(status_code=400, detail="Empty audio file")

        result = await voice_manager.transcribe(content, filename=file.filename or "audio.wav")
        return result
    except Exception as e:
        logger.error("STT transcription error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/settings", response_model=VoiceSettingsModel)
async def get_voice_settings():
    """Retrieve current voice engine settings."""
    return voice_manager.settings


@router.post("/settings", response_model=VoiceSettingsModel)
async def update_voice_settings(settings: VoiceSettingsModel):
    """Update and persist voice configuration (Fish Audio, Piper, ElevenLabs, Wake-word)."""
    updated = voice_manager.update_settings(settings)
    return updated


@router.get("/voices")
async def list_available_voices():
    """List all available voices across Fish Audio, Piper, and ElevenLabs."""
    return {"voices": TTSFactory.list_voices()}


@router.post("/wakeword/check")
async def check_wakeword(payload: dict):
    """Check text for wake word detection."""
    text = payload.get("text", "")
    detected = voice_manager.wake_detector.process_text(text)
    return {"detected": detected, "target": voice_manager.wake_detector.target_word}
