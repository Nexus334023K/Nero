import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from app.database.init_db import init_database
from app.database.models import AIProvider, ToolPermission
from app.database.session import AsyncSessionLocal
from app.main import app


@pytest.mark.asyncio
async def test_database_seeding():
    """Verify that default AI providers and tool permissions are seeded."""
    await init_database()
    async with AsyncSessionLocal() as session:
        # Check providers
        result = await session.execute(select(AIProvider))
        providers = result.scalars().all()
        provider_names = {p.name for p in providers}
        assert "gemini" in provider_names
        assert "openai" in provider_names
        assert "ollama" in provider_names

        # Check tool permissions
        result = await session.execute(select(ToolPermission))
        tools = result.scalars().all()
        tool_names = {t.tool_name for t in tools}
        assert "get_system_time" in tool_names
        assert "read_system_status" in tool_names
        assert "launch_application" in tool_names
        assert "delete_file" in tool_names


@pytest.mark.asyncio
async def test_chat_flow_and_persistence():
    """Verify sending a chat message, receiving response, and persisting in SQLite."""
    await init_database()
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        # Send a chat message
        response = await client.post(
            "/api/chat",
            json={"message": "Hello NERO, who are you?", "personality_mode": "friend"},
        )
        assert response.status_code == 200
        data = response.json()
        assert "response" in data
        assert "conversation_id" in data
        assert "message_id" in data
        assert "model_used" in data
        assert isinstance(data["model_used"], str) and len(data["model_used"]) > 0
        conv_id = data["conversation_id"]

        # Fetch conversations list
        conv_response = await client.get("/api/chat/conversations")
        assert conv_response.status_code == 200
        conversations = conv_response.json()["conversations"]
        assert any(c["id"] == conv_id for c in conversations)

        # Fetch messages for this conversation
        msg_response = await client.get(f"/api/chat/conversations/{conv_id}/messages")
        assert msg_response.status_code == 200
        messages = msg_response.json()["messages"]
        assert len(messages) >= 2
        assert messages[0]["role"] == "user"
        assert messages[0]["content"] == "Hello NERO, who are you?"
        assert messages[1]["role"] == "assistant"
