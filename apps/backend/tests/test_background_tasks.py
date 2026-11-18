import asyncio
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.database.init_db import init_database
from app.main import app
from app.agents.base import AgentCapability, DANGEROUS_CAPABILITIES
from app.agents.registry import agent_registry, GeneralAgent
from app.agents.research_pipeline import ResearchAgent
from app.agents.security import URLSafetyGuard, PromptInjectionGuard
from app.engine.task_engine import task_engine
from app.intelligence.orchestrator import AIOrchestrator
from app.schemas.chat import ChatRequest


@pytest_asyncio.fixture(autouse=True)
async def setup_db():
    await init_database()


@pytest.mark.asyncio
async def test_agent_registry_and_capabilities():
    """Verify modular agents are registered and dangerous capabilities are forbidden."""
    gen = agent_registry.get("general")
    res = agent_registry.get("research")

    assert gen is not None
    assert res is not None

    # Verify GeneralAgent permissions
    assert gen.can_use_capability(AgentCapability.WEB_SEARCH) is True
    assert gen.can_use_capability(AgentCapability.FILE_READ) is True
    assert gen.can_use_capability(AgentCapability.SHELL_EXEC) is False
    assert gen.can_use_capability(AgentCapability.FILE_DELETE) is False

    # Verify ResearchAgent permissions
    assert res.can_use_capability(AgentCapability.WEB_SEARCH) is True
    assert res.can_use_capability(AgentCapability.WEB_READ) is True
    assert res.can_use_capability(AgentCapability.SHELL_EXEC) is False
    assert res.can_use_capability(AgentCapability.FINANCIAL_TRANSACTIONS) is False

    # Verify registry capability enforcement
    for dang in DANGEROUS_CAPABILITIES:
        assert agent_registry.can_use_capability("general", dang) is False
        assert agent_registry.can_use_capability("research", dang) is False


@pytest.mark.asyncio
async def test_url_safety_and_prompt_injection_guard():
    """Verify SSRF, loopback, private IP blocking, and prompt isolation."""
    # Bad schemes
    safe, err, _ = URLSafetyGuard.validate_url("file:///etc/passwd")
    assert safe is False
    assert "scheme" in err.lower()

    safe, err, _ = URLSafetyGuard.validate_url("javascript:alert(1)")
    assert safe is False

    # Localhost / loopback / private IP blocking
    safe, err, _ = URLSafetyGuard.validate_url("http://localhost:8080/admin")
    assert safe is False
    assert "blocked" in err.lower()

    safe, err, _ = URLSafetyGuard.validate_url("http://127.0.0.1:3000")
    assert safe is False

    safe, err, _ = URLSafetyGuard.validate_url("http://169.254.169.254/latest/meta-data/")
    assert safe is False

    safe, err, _ = URLSafetyGuard.validate_url("http://192.168.1.1/router")
    assert safe is False

    # Prompt injection guard wrapping
    wrapped = PromptInjectionGuard.wrap_content("https://example.com", "Example Title", "Some untrusted text")
    assert "<untrusted_web_source" in wrapped
    assert "SYSTEM NOTICE" in wrapped
    assert "</untrusted_web_source>" in wrapped


@pytest.mark.asyncio
async def test_task_engine_lifecycle_and_checkpointing():
    """Verify background task creation, sequential planning, checkpoints, and completion."""
    task = await task_engine.create_task(
        user_id="00000000-0000-0000-0000-000000000001",
        request="Test research task on anime shaders",
        title="Test Anime Shaders",
        assigned_agent="research",
    )
    assert task.id is not None
    assert task.status in ("queued", "planning", "running")

    # Wait briefly for background execution to begin and advance
    for _ in range(25):
        await asyncio.sleep(0.2)
        # Check if task has planned or completed steps
        from sqlalchemy import select
        from app.database.models import BackgroundTask
        from app.database.session import AsyncSessionLocal
        async with AsyncSessionLocal() as session:
            t = (await session.execute(select(BackgroundTask).where(BackgroundTask.id == task.id))).scalar_one()
            if t.total_steps > 0 and t.current_step > 0:
                assert t.plan is not None
                assert len(t.plan) > 0
                assert t.checkpoint is not None
                assert "completed_step" in t.checkpoint
                break

    # Steer the task
    steer_ok = await task_engine.steer_task(task.id, "Prioritize stylized outline rendering")
    assert steer_ok is True

    # Finish early test
    await task_engine.finish_early(task.id)
    await asyncio.sleep(0.5)

    async with AsyncSessionLocal() as session:
        t = (await session.execute(select(BackgroundTask).where(BackgroundTask.id == task.id))).scalar_one()
        assert t.status in ("running", "completed")


@pytest.mark.asyncio
async def test_tasks_api_endpoints():
    """Verify full REST API for background tasks."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Create task via POST /api/tasks
        resp = await ac.post(
            "/api/tasks",
            json={
                "request": "Compare React and Svelte reactive primitives",
                "title": "React vs Svelte Comparison",
                "assigned_agent": "general",
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        task_id = data["id"]
        assert data["title"] == "React vs Svelte Comparison"
        assert data["assigned_agent"] == "general"

        # List tasks via GET /api/tasks
        list_resp = await ac.get("/api/tasks")
        assert list_resp.status_code == 200
        list_data = list_resp.json()
        assert list_data["total"] >= 1
        assert any(t["id"] == task_id for t in list_data["tasks"])

        # Get task details via GET /api/tasks/{task_id}
        get_resp = await ac.get(f"/api/tasks/{task_id}")
        assert get_resp.status_code == 200
        assert get_resp.json()["id"] == task_id

        # Get progress via GET /api/tasks/{task_id}/progress
        prog_resp = await ac.get(f"/api/tasks/{task_id}/progress")
        assert prog_resp.status_code == 200
        assert "progress" in prog_resp.json()

        # Inject steering via POST /api/tasks/{task_id}/steer
        steer_resp = await ac.post(
            f"/api/tasks/{task_id}/steer",
            json={"instruction": "Focus on bundle size and hydration overhead"},
        )
        assert steer_resp.status_code == 200
        assert steer_resp.json()["status"] == "steered"

        # Pause, resume, and retry
        await ac.post(f"/api/tasks/{task_id}/pause")
        res_resp = await ac.post(f"/api/tasks/{task_id}/resume")
        assert res_resp.status_code in (200, 400)

        # Retry endpoint
        retry_resp = await ac.post(f"/api/tasks/{task_id}/retry")
        assert retry_resp.status_code == 200
        assert retry_resp.json()["status"] == "queued"

        # Get report
        rep_resp = await ac.get(f"/api/tasks/{task_id}/report")
        assert rep_resp.status_code == 200
        assert "report_markdown" in rep_resp.json()

        # Delete task
        del_resp = await ac.delete(f"/api/tasks/{task_id}")
        assert del_resp.status_code == 200


@pytest.mark.asyncio
async def test_chat_background_task_intent():
    """Verify natural chat triggers background tasks for research queries."""
    orchestrator = AIOrchestrator()

    # Research query intent
    intent = orchestrator.detect_background_task_intent("research WebAssembly performance vs native C++")
    assert intent is not None
    agent, query, title = intent
    assert agent == "research"
    assert "webassembly" in query.lower()

    # Deep dive intent
    intent2 = orchestrator.detect_background_task_intent("deep dive into SQLite concurrency models")
    assert intent2 is not None
    assert intent2[0] == "research"

    # Explicit background task intent
    intent3 = orchestrator.detect_background_task_intent("background task: inspect open git branches")
    assert intent3 is not None
    assert intent3[0] == "general"

    # Normal conversation should NOT trigger background task
    assert orchestrator.detect_background_task_intent("Hello Nero, how are you?") is None
    assert orchestrator.detect_background_task_intent("What is 2 + 2?") is None
