import json
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import settings
from app.core.logging_config import get_logger, setup_logging
from app.database.init_db import init_database
from app.engine.task_engine import task_engine
from app.websocket.manager import manager

setup_logging()
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting NERO backend …")
    await init_database()

    # Register task engine event bridge to WebSocket
    def _ws_bridge(task_id: str, event_type: str, payload: dict):
        import asyncio
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(
                manager.broadcast_json({
                    "type": "task_event",
                    "event": event_type,
                    "task_id": task_id,
                    "data": payload,
                })
            )
        except RuntimeError:
            pass

    task_engine.register_listener(_ws_bridge)
    await task_engine.startup()
    logger.info("NERO backend ready on %s:%d", settings.backend_host, settings.backend_port)
    yield
    # Shutdown
    logger.info("NERO backend shutting down.")
    await task_engine.shutdown()


app = FastAPI(
    title="NERO Backend",
    version=settings.version,
    description="Backend API for NERO — Windows Desktop AI Companion",
    lifespan=lifespan,
)

# CORS middleware for Vite dev server and Electron
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include all API routes under /api
app.include_router(api_router)


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
            except json.JSONDecodeError:
                await manager.send_json(
                    {"type": "error", "data": {"detail": "Invalid JSON"}}, websocket
                )
                continue

            if msg.get("type") == "ping":
                await manager.send_json(
                    {"type": "pong", "timestamp": datetime.now(timezone.utc).isoformat()},
                    websocket,
                )
            else:
                await manager.send_json({"type": "echo", "data": msg}, websocket)
    except WebSocketDisconnect:
        await manager.disconnect(websocket)

