import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging_config import get_logger
from app.database.models import Conversation, Message, User
from app.database.session import get_db
from app.schemas.chat import ChatRequest, ChatResponse

logger = get_logger(__name__)

router = APIRouter(prefix="/chat", tags=["chat"])

_PLACEHOLDER_RESPONSE = (
    "Hello! I'm NERO, your AI companion. I'm currently running in placeholder mode "
    "because no AI provider has been configured yet. To enable full AI responses, "
    "please configure an AI provider (Gemini, OpenAI, or Ollama) in the settings."
)

_DEFAULT_USER_ID = "00000000-0000-0000-0000-000000000001"


async def _ensure_default_user(db: AsyncSession) -> User:
    result = await db.execute(select(User).where(User.id == _DEFAULT_USER_ID))
    user = result.scalar_one_or_none()
    if user is None:
        user = User(id=_DEFAULT_USER_ID, name="Default User")
        db.add(user)
        await db.flush()
    return user


@router.post("", response_model=ChatResponse)
async def send_chat_message(
    request: ChatRequest,
    db: AsyncSession = Depends(get_db),
) -> ChatResponse:
    """Send a chat message and receive a response."""
    await _ensure_default_user(db)

    # Resolve or create conversation
    conversation_id = request.conversation_id
    if conversation_id:
        result = await db.execute(
            select(Conversation).where(Conversation.id == conversation_id)
        )
        conversation = result.scalar_one_or_none()
        if conversation is None:
            raise HTTPException(status_code=404, detail="Conversation not found")
    else:
        conversation = Conversation(
            id=str(uuid.uuid4()),
            user_id=_DEFAULT_USER_ID,
            title=request.message[:60],
            personality_mode=request.personality_mode,
        )
        db.add(conversation)
        await db.flush()
        conversation_id = conversation.id

    # Save user message
    user_msg = Message(
        id=str(uuid.uuid4()),
        conversation_id=conversation_id,
        role="user",
        content=request.message,
        model_used=None,
    )
    db.add(user_msg)

    # Placeholder AI response
    assistant_msg_id = str(uuid.uuid4())
    assistant_msg = Message(
        id=assistant_msg_id,
        conversation_id=conversation_id,
        role="assistant",
        content=_PLACEHOLDER_RESPONSE,
        model_used="placeholder",
    )
    db.add(assistant_msg)
    await db.flush()

    return ChatResponse(
        response=_PLACEHOLDER_RESPONSE,
        conversation_id=conversation_id,
        message_id=assistant_msg_id,
        model_used="placeholder",
        timestamp=datetime.now(timezone.utc).isoformat(),
    )


@router.get("/conversations")
async def list_conversations(db: AsyncSession = Depends(get_db)) -> dict:
    """List all conversations."""
    result = await db.execute(
        select(Conversation).order_by(Conversation.created_at.desc())
    )
    conversations = result.scalars().all()
    return {
        "conversations": [
            {
                "id": c.id,
                "title": c.title,
                "personality_mode": c.personality_mode,
                "created_at": c.created_at.isoformat() if c.created_at else None,
                "updated_at": c.updated_at.isoformat() if c.updated_at else None,
            }
            for c in conversations
        ]
    }


@router.get("/conversations/{conversation_id}/messages")
async def get_conversation_messages(
    conversation_id: str, db: AsyncSession = Depends(get_db)
) -> dict:
    """Get all messages in a conversation."""
    result = await db.execute(
        select(Conversation).where(Conversation.id == conversation_id)
    )
    conversation = result.scalar_one_or_none()
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    msg_result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.asc())
    )
    messages = msg_result.scalars().all()
    return {
        "messages": [
            {
                "id": m.id,
                "role": m.role,
                "content": m.content,
                "model_used": m.model_used,
                "created_at": m.created_at.isoformat() if m.created_at else None,
            }
            for m in messages
        ]
    }
