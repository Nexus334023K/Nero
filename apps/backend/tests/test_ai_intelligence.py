import json
import pytest
from httpx import ASGITransport, AsyncClient

from app.database.init_db import init_database
from app.intelligence.personality.engine import PersonalityEngine
from app.intelligence.providers.gemini_provider import GeminiProvider
from app.intelligence.providers.offline_provider import OfflineProvider
from app.intelligence.providers.ollama_provider import OllamaProvider
from app.intelligence.providers.openai_provider import OpenAIProvider
from app.intelligence.router import AIRouter
from app.main import app


@pytest.mark.asyncio
async def test_offline_provider():
    """Verify OfflineProvider functionality, properties, and generation."""
    provider = OfflineProvider()
    assert provider.name == "offline"
    assert provider.provider_type == "local"
    assert provider.is_configured is True
    assert await provider.check_health() is True

    # Test greetings
    res_greet = await provider.generate("hello there", system_prompt="friend")
    assert any(w in res_greet.lower() for w in ["hey", "hello", "great"])

    # Test time
    res_time = await provider.generate("what time is it?")
    assert "system time" in res_time.lower()

    # Test identity
    res_id = await provider.generate("who are you?")
    assert "NERO" in res_id

    # Test streaming
    tokens = []
    async for token in provider.generate_stream("hello friend", system_prompt="friend"):
        tokens.append(token)
    assert len(tokens) > 0
    joined = "".join(tokens)
    assert len(joined) > 5


@pytest.mark.asyncio
async def test_unconfigured_providers_graceful_fallbacks():
    """Verify Gemini, OpenAI, and Ollama handle unconfigured/unreachable states gracefully."""
    gemini = GeminiProvider(api_key="")
    assert gemini.name == "gemini"
    assert gemini.is_configured is False
    res_g = await gemini.generate("Test prompt")
    assert "Offline Fallback" in res_g

    openai = OpenAIProvider(api_key="")
    assert openai.name == "openai"
    assert openai.is_configured is False
    res_o = await openai.generate("Test prompt")
    assert "Offline Fallback" in res_o

    ollama = OllamaProvider(base_url="http://localhost:99999")
    assert ollama.name == "ollama"
    healthy = await ollama.check_health()
    assert healthy is False
    res_ol = await ollama.generate("Test prompt")
    assert "Ollama Fallback" in res_ol or "Could not reach" in res_ol


def test_personality_engine():
    """Verify PersonalityEngine mode switching, validation, and dynamic prompt building."""
    engine = PersonalityEngine()

    # Default mode
    assert engine.get_mode() == "adaptive"

    # Switching modes
    assert engine.set_mode("focus") is True
    assert engine.get_mode() == "focus"

    prompt_focus = engine.build_system_prompt()
    assert "Focus" in prompt_focus

    assert engine.set_mode("friend") is True
    prompt_friend = engine.build_system_prompt()
    assert "Friend" in prompt_friend

    # Invalid mode
    assert engine.set_mode("non_existent_mode") is False
    assert engine.get_mode() == "friend"

    # Adaptive context tuning
    engine.set_mode("adaptive")
    adaptive_code = engine.build_system_prompt(user_message="Fix this python bug in my code")
    assert "technical or code objective" in adaptive_code

    # Available modes
    modes = engine.get_available_modes()
    assert len(modes) == 5
    mode_ids = {m["id"] for m in modes}
    assert {"friend", "professional", "focus", "supportive", "adaptive"} == mode_ids


@pytest.mark.asyncio
async def test_ai_router_and_fallbacks():
    """Verify AIRouter provider registry, fallbacks, and tests."""
    router = AIRouter()
    providers = await router.list_providers()
    provider_names = {p["name"] for p in providers}
    assert {"gemini", "openai", "ollama", "offline"}.issubset(provider_names)

    # When cloud providers have no keys, selecting gemini falls back to offline
    selected = await router.select_provider(preferred="gemini")
    assert selected.name == "offline"

    # Testing offline provider
    test_res = await router.test_provider("offline")
    assert test_res["name"] == "offline"
    assert test_res["available"] is True


@pytest.mark.asyncio
async def test_chat_stream_endpoint():
    """Verify POST /api/chat/stream SSE streaming responses."""
    await init_database()
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        async with client.stream(
            "POST",
            "/api/chat/stream",
            json={"message": "Hello from stream test", "personality_mode": "friend"},
        ) as response:
            assert response.status_code == 200
            assert "text/event-stream" in response.headers.get("content-type", "")

            lines = []
            async for line in response.aiter_lines():
                if line.startswith("data: "):
                    lines.append(json.loads(line[6:]))

            assert len(lines) >= 2
            event_types = [ev.get("type") for ev in lines]
            assert "start" in event_types
            assert "chunk" in event_types
            assert "done" in event_types

            done_event = next(ev for ev in lines if ev.get("type") == "done")
            assert "conversation_id" in done_event
            assert "message_id" in done_event
            assert "response" in done_event
            assert len(done_event["response"]) > 0


@pytest.mark.asyncio
async def test_providers_api():
    """Verify GET /api/providers, POST /api/providers/test, and POST /api/providers/config."""
    await init_database()
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        # GET /api/providers
        res = await client.get("/api/providers")
        assert res.status_code == 200
        data = res.json()
        assert "providers" in data
        assert "active_provider" in data
        provider_names = {p["name"] for p in data["providers"]}
        assert "gemini" in provider_names
        assert "offline" in provider_names

        # POST /api/providers/test (offline)
        test_res = await client.post("/api/providers/test", json={"provider": "offline"})
        assert test_res.status_code == 200
        assert test_res.json()["available"] is True

        # POST /api/providers/config
        cfg_res = await client.post(
            "/api/providers/config",
            json={
                "provider": "gemini",
                "api_key": "test_dummy_key",
                "model": "gemini-1.5-flash",
                "is_active": False,
            },
        )
        assert cfg_res.status_code == 200
        cfg_data = cfg_res.json()
        assert cfg_data["status"] == "success"
        assert cfg_data["model"] == "gemini-1.5-flash"


@pytest.mark.asyncio
async def test_personality_api():
    """Verify GET /api/personality/modes and POST /api/personality/mode."""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        # GET modes
        res = await client.get("/api/personality/modes")
        assert res.status_code == 200
        data = res.json()
        assert "active_mode" in data
        assert "modes" in data
        assert len(data["modes"]) == 5

        # POST mode (valid)
        set_res = await client.post("/api/personality/mode", json={"mode": "focus"})
        assert set_res.status_code == 200
        assert set_res.json()["active_mode"] == "focus"

        # POST mode (invalid)
        err_res = await client.post("/api/personality/mode", json={"mode": "invalid_super_mode"})
        assert err_res.status_code == 400
