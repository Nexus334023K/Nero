from enum import Enum
from typing import Optional

from pydantic import BaseModel


class MessageRole(str, Enum):
    user = "user"
    assistant = "assistant"
    system = "system"


class ChatMessage(BaseModel):
    role: MessageRole
    content: str
    timestamp: Optional[str] = None


class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None
    personality_mode: str = "adaptive"
    provider: Optional[str] = None
    model: Optional[str] = None


class ChatResponse(BaseModel):
    response: str
    conversation_id: str
    message_id: str
    model_used: str
    timestamp: str
