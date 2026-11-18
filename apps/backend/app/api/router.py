from fastapi import APIRouter

from app.api.chat import router as chat_router
from app.api.health import router as health_router
from app.api.personality import router as personality_router
from app.api.providers import router as providers_router
from app.api.voice import router as voice_router
from app.api.memory import router as memory_router
from app.api.tools import router as tools_router
from app.api.productivity import router as productivity_router
from app.api.tasks import router as tasks_router

api_router = APIRouter(prefix="/api")

api_router.include_router(health_router)
api_router.include_router(chat_router)
api_router.include_router(providers_router)
api_router.include_router(personality_router)
api_router.include_router(voice_router)
api_router.include_router(memory_router)
api_router.include_router(tools_router)
api_router.include_router(productivity_router)
api_router.include_router(tasks_router)
