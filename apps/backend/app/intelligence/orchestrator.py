import json
import uuid
from datetime import datetime, timezone
from typing import Any, AsyncGenerator

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging_config import get_logger
from app.database.models import Conversation, Message, User
from app.database.session import AsyncSessionLocal
from app.intelligence.personality.engine import personality_engine
from app.intelligence.router import ai_router
from app.memory.manager import memory_manager
from app.schemas.chat import ChatRequest, ChatResponse
from app.tools.intent import ToolIntentDetector
from app.tools.registry import tool_registry

logger = get_logger(__name__)

DEFAULT_USER_ID = "00000000-0000-0000-0000-000000000001"


class AIOrchestrator:
    """Coordinates intent analysis, personality system prompts, model routing,
    desktop automation tools, streaming generation, and persistence into SQLite.
    """

    def __init__(self) -> None:
        self.router = ai_router
        self.personality = personality_engine

    async def ensure_default_user(self, db: AsyncSession) -> User:
        result = await db.execute(select(User).where(User.id == DEFAULT_USER_ID))
        user = result.scalar_one_or_none()
        if user is None:
            user = User(id=DEFAULT_USER_ID, name="Default User")
            db.add(user)
            await db.flush()
        return user

    async def get_or_create_conversation(
        self,
        db: AsyncSession,
        conversation_id: str | None,
        title: str,
        personality_mode: str,
    ) -> Conversation:
        await self.ensure_default_user(db)

        if conversation_id:
            result = await db.execute(
                select(Conversation).where(Conversation.id == conversation_id)
            )
            conv = result.scalar_one_or_none()
            if conv:
                return conv

        new_conv = Conversation(
            id=conversation_id or str(uuid.uuid4()),
            user_id=DEFAULT_USER_ID,
            title=title[:60] if title else "New Conversation",
            personality_mode=personality_mode or self.personality.get_mode(),
        )
        db.add(new_conv)
        await db.flush()
        return new_conv

    async def get_conversation_history(
        self,
        db: AsyncSession,
        conversation_id: str,
        limit: int = 10,
    ) -> list[dict[str, str]]:
        result = await db.execute(
            select(Message)
            .where(Message.conversation_id == conversation_id)
            .order_by(Message.created_at.desc())
            .limit(limit)
        )
        messages = list(reversed(result.scalars().all()))
        return [{"role": m.role, "content": m.content} for m in messages]

    async def process_chat(
        self,
        db: AsyncSession,
        request: ChatRequest,
    ) -> ChatResponse:
        """Processes a chat request end-to-end, persists messages, and returns ChatResponse."""
        conversation = await self.get_or_create_conversation(
            db=db,
            conversation_id=request.conversation_id,
            title=request.message,
            personality_mode=request.personality_mode,
        )
        conv_id = conversation.id

        # Save user message
        user_msg = Message(
            id=str(uuid.uuid4()),
            conversation_id=conv_id,
            role="user",
            content=request.message,
            model_used=None,
        )
        db.add(user_msg)
        await db.flush()

        # Check for tool intent
        tool_action_context = ""
        tool_intent = ToolIntentDetector.detect(request.message)
        if tool_intent:
            tool_name, tool_params = tool_intent
            tool_res = await tool_registry.execute_tool(tool_name, tool_params, db=db)
            if tool_res.get("status") == "approval_required":
                approval = tool_res["approval"]
                response_text = (
                    f"I need your approval before proceeding with this action:\n\n"
                    f"**Action**: `{tool_name}`\n"
                    f"**Reason**: {approval.get('reason')}\n\n"
                    f"<!-- APPROVAL_TOKEN:{approval.get('token')} TOOL:{tool_name} -->\n"
                    f"Would you like me to proceed?"
                )
                assistant_msg_id = str(uuid.uuid4())
                assistant_msg = Message(
                    id=assistant_msg_id,
                    conversation_id=conv_id,
                    role="assistant",
                    content=response_text,
                    model_used="nero:tool-permission",
                )
                db.add(assistant_msg)
                await db.commit()
                return ChatResponse(
                    response=response_text,
                    conversation_id=conv_id,
                    message_id=assistant_msg_id,
                    model_used="nero:tool-permission",
                    timestamp=datetime.now(timezone.utc).isoformat(),
                )
            elif tool_res.get("status") == "success":
                tool_action_context = (
                    f"\n\n[LIVE DESKTOP TOOL RESULT]:\n"
                    f"Tool: {tool_name}\n"
                    f"Output: {json.dumps(tool_res.get('result', {}))}\n"
                    f"Synthesize this live data and respond to the user naturally."
                )

        # Build prompt & route to provider
        history = await self.get_conversation_history(db, conv_id, limit=8)
        mode = request.personality_mode or conversation.personality_mode
        system_prompt = self.personality.build_system_prompt(
            mode=mode,
            user_message=request.message,
        )
        if tool_action_context:
            system_prompt += tool_action_context

        # Retrieve relevant memories and inject into prompt
        try:
            memories = await memory_manager.semantic_search(request.message, user_id=DEFAULT_USER_ID, limit=3)
            if memories:
                mem_lines = "\n".join([f"- {m['content']}" for m in memories if m.get("content")])
                if mem_lines:
                    system_prompt += f"\n\n[RECALLED USER MEMORIES & CONTEXT]:\n{mem_lines}\nUse these recalled user context details to personalize your answers naturally."
        except Exception as e:
            logger.warning("Memory retrieval notice: %s", e)

        # Auto-extract new memory candidates in background
        try:
            await memory_manager.process_chat_message_for_memories(request.message, user_id=DEFAULT_USER_ID)
        except Exception as e:
            logger.warning("Memory extraction notice: %s", e)

        provider = await self.router.select_provider()
        model_name = f"{provider.name}:{provider.default_model}"

        response_text = await provider.generate(
            prompt=request.message,
            history=history,
            system_prompt=system_prompt,
        )

        # Save assistant message
        assistant_msg_id = str(uuid.uuid4())
        assistant_msg = Message(
            id=assistant_msg_id,
            conversation_id=conv_id,
            role="assistant",
            content=response_text,
            model_used=model_name,
        )
        db.add(assistant_msg)
        await db.commit()

        return ChatResponse(
            response=response_text,
            conversation_id=conv_id,
            message_id=assistant_msg_id,
            model_used=model_name,
            timestamp=datetime.now(timezone.utc).isoformat(),
        )

    async def stream_chat(
        self,
        request: ChatRequest,
    ) -> AsyncGenerator[str, None]:
        """Streams chat tokens using SSE (Server-Sent Events) and saves final output."""
        async with AsyncSessionLocal() as init_db:
            conversation = await self.get_or_create_conversation(
                db=init_db,
                conversation_id=request.conversation_id,
                title=request.message,
                personality_mode=request.personality_mode,
            )
            conv_id = conversation.id

            user_msg = Message(
                id=str(uuid.uuid4()),
                conversation_id=conv_id,
                role="user",
                content=request.message,
                model_used=None,
            )
            init_db.add(user_msg)
            await init_db.commit()

            history = await self.get_conversation_history(init_db, conv_id, limit=8)
            mode = request.personality_mode or conversation.personality_mode

            # Tool intent detection
            tool_action_context = ""
            tool_intent = ToolIntentDetector.detect(request.message)
            if tool_intent:
                tool_name, tool_params = tool_intent
                tool_res = await tool_registry.execute_tool(tool_name, tool_params, db=init_db)
                if tool_res.get("status") == "approval_required":
                    approval = tool_res["approval"]
                    token = approval.get("token")
                    reason = approval.get("reason")
                    approval_text = (
                        f"I need your approval before executing `{tool_name}`: {reason}\n\n"
                        f"<!-- APPROVAL_TOKEN:{token} TOOL:{tool_name} -->"
                    )
                    assistant_msg_id = str(uuid.uuid4())
                    start_payload = {
                        "type": "start",
                        "conversation_id": conv_id,
                        "message_id": assistant_msg_id,
                        "model_used": "nero:tool-permission",
                    }
                    yield f"data: {json.dumps(start_payload)}\n\n"
                    yield f"data: {json.dumps({'type': 'chunk', 'content': approval_text})}\n\n"

                    # Save and finish
                    async with AsyncSessionLocal() as save_db:
                        save_db.add(Message(
                            id=assistant_msg_id,
                            conversation_id=conv_id,
                            role="assistant",
                            content=approval_text,
                            model_used="nero:tool-permission",
                        ))
                        await save_db.commit()

                    done_payload = {
                        "type": "done",
                        "conversation_id": conv_id,
                        "message_id": assistant_msg_id,
                        "model_used": "nero:tool-permission",
                        "response": approval_text,
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                        "approval": approval,
                    }
                    yield f"data: {json.dumps(done_payload)}\n\n"
                    return

                elif tool_res.get("status") == "success":
                    tool_action_context = (
                        f"\n\n[LIVE DESKTOP TOOL RESULT]:\n"
                        f"Tool: {tool_name}\n"
                        f"Output: {json.dumps(tool_res.get('result', {}))}\n"
                        f"Synthesize this live data and respond to the user naturally."
                    )

        system_prompt = self.personality.build_system_prompt(
            mode=mode,
            user_message=request.message,
        )
        if tool_action_context:
            system_prompt += tool_action_context

        # Retrieve relevant memories and inject into prompt
        try:
            memories = await memory_manager.semantic_search(request.message, user_id=DEFAULT_USER_ID, limit=3)
            if memories:
                mem_lines = "\n".join([f"- {m['content']}" for m in memories if m.get("content")])
                if mem_lines:
                    system_prompt += f"\n\n[RECALLED USER MEMORIES & CONTEXT]:\n{mem_lines}\nUse these recalled user context details to personalize your answers naturally."
        except Exception as e:
            logger.warning("Stream memory retrieval notice: %s", e)

        # Auto-extract new memory candidates in background
        try:
            await memory_manager.process_chat_message_for_memories(request.message, user_id=DEFAULT_USER_ID)
        except Exception as e:
            logger.warning("Stream memory extraction notice: %s", e)

        provider = await self.router.select_provider()
        model_name = f"{provider.name}:{provider.default_model}"
        assistant_msg_id = str(uuid.uuid4())

        # Send start event
        start_payload = {
            "type": "start",
            "conversation_id": conv_id,
            "message_id": assistant_msg_id,
            "model_used": model_name,
        }
        yield f"data: {json.dumps(start_payload)}\n\n"

        accumulated_chunks: list[str] = []

        try:
            async for token in provider.generate_stream(
                prompt=request.message,
                history=history,
                system_prompt=system_prompt,
            ):
                accumulated_chunks.append(token)
                chunk_payload = {
                    "type": "chunk",
                    "content": token,
                }
                yield f"data: {json.dumps(chunk_payload)}\n\n"
        except Exception as e:
            logger.error("Streaming error: %s", e)
            err_payload = {"type": "error", "error": str(e)}
            yield f"data: {json.dumps(err_payload)}\n\n"

        full_text = "".join(accumulated_chunks)

        # Save completed assistant message to database
        async with AsyncSessionLocal() as save_db:
            assistant_msg = Message(
                id=assistant_msg_id,
                conversation_id=conv_id,
                role="assistant",
                content=full_text,
                model_used=model_name,
            )
            save_db.add(assistant_msg)
            await save_db.commit()

        # Send done event
        done_payload = {
            "type": "done",
            "conversation_id": conv_id,
            "message_id": assistant_msg_id,
            "model_used": model_name,
            "response": full_text,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        yield f"data: {json.dumps(done_payload)}\n\n"


orchestrator = AIOrchestrator()
