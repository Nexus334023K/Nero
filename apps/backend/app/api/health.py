import time
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.database.session import get_db
from app.schemas.health import HealthStatus

router = APIRouter(prefix="/health", tags=["health"])

_start_time: float = time.time()


@router.get("", response_model=HealthStatus)
async def health_check(db: AsyncSession = Depends(get_db)) -> HealthStatus:
    """Full health check including database connectivity."""
    # Check database
    db_status = "disconnected"
    try:
        await db.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception:
        pass

    overall = "healthy" if db_status == "connected" else "degraded"

    return HealthStatus(
        status=overall,
        version=settings.version,
        environment=settings.environment,
        timestamp=datetime.now(timezone.utc).isoformat(),
        database=db_status,
        uptime_seconds=round(time.time() - _start_time, 2),
        services={
            "api": "running",
            "database": db_status,
            "websocket": "running",
        },
    )


@router.get("/ping")
async def ping() -> dict:
    """Lightweight liveness check."""
    return {"pong": True, "timestamp": datetime.now(timezone.utc).isoformat()}

