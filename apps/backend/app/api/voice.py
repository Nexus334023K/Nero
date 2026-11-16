from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import Response, StreamingResponse

from app.core.logging_config import get_logger
from app.voice.manager import voice_manager
from app.voice.schemas import STTResponse, TTSRequest, VoiceSettingsModel
from app.voice.tts.factory import TTSFactory

logger = get_logger(__name__)

router = APIRouter(prefix="/voice", tags=["voice"])


@router.post("/tts")
async def text_to_speech(req: TTSRequest):
    """Synthesize text into speech audio bytes."""
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")

    stream, mime_type = await voice_manager.synthesize_stream(
        text=req.text,
        provider=req.provider,
        voice_id=req.voice_id,
        speed=req.speed,
    )

    return StreamingResponse(
        stream,
        media_type=mime_type,
        headers={
            "Content-Disposition": f'inline; filename="speech.{mime_type.split("/")[-1]}"',
            "Cache-Control": "no-cache",
        },
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
        logger.error(f"STT transcription error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/settings", response_model=VoiceSettingsModel)
async def get_voice_settings():
    """Retrieve current voice engine settings."""
    return voice_manager.settings


@router.post("/settings", response_model=VoiceSettingsModel)
async def update_voice_settings(settings: VoiceSettingsModel):
    """Update voice configuration (Fish Audio, Piper, ElevenLabs, Wake-word)."""
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
