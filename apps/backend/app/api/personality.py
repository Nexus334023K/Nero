from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.intelligence.personality.engine import personality_engine

router = APIRouter(prefix="/personality", tags=["personality"])


class SetModeRequest(BaseModel):
    mode: str


@router.get("/modes")
async def get_personality_modes() -> dict:
    """List all available personality modes and which one is active."""
    return {
        "active_mode": personality_engine.get_mode(),
        "modes": personality_engine.get_available_modes(),
    }


@router.post("/mode")
async def set_personality_mode(request: SetModeRequest) -> dict:
    """Set the active personality mode for NERO."""
    success = personality_engine.set_mode(request.mode)
    if not success:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid personality mode: '{request.mode}'. Choose from: friend, professional, focus, supportive, adaptive.",
        )
    return {
        "status": "success",
        "active_mode": personality_engine.get_mode(),
    }
