from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class WSMessageType(str, Enum):
    ping = "ping"
    pong = "pong"
    status = "status"
    chat_message = "chat_message"
    chat_response = "chat_response"
    error = "error"
    system = "system"


class WSMessage(BaseModel):
    type: WSMessageType
    data: Optional[dict] = None
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
