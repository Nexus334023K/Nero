import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.database.init_db import init_database
from app.main import app
from app.tools.developer.git_analyzer import GitAnalyzerTool
from app.tools.developer.project_analyzer import ProjectStructureTool
from app.tools.intent import ToolIntentDetector
from app.tools.productivity.task_manager import TaskManagerTool
from app.tools.research.web_reader import WebPageReaderTool
from app.tools.research.web_search import WebSearchTool


@pytest_asyncio.fixture(autouse=True)
async def setup_db():
    await init_database()


@pytest.mark.asyncio
async def test_web_search_tool():
    tool = WebSearchTool()
    valid, err = tool.validate_params({"query": "Python programming"})
    assert valid is True

    valid, err = tool.validate_params({})
    assert valid is False

    res = await tool.execute({"query": "Python FastAPI", "limit": 3})
    assert res.success is True
    assert "results" in res.output
    assert len(res.output["results"]) > 0
    assert "url" in res.output["results"][0]


@pytest.mark.asyncio
async def test_web_page_reader_tool():
    tool = WebPageReaderTool()
    valid, err = tool.validate_params({"url": "https://example.com"})
    assert valid is True

    valid, err = tool.validate_params({"url": "ftp://bad-url"})
    assert valid is False

    # Test HTML cleaning logic
    sample_html = "<html><head><title>Test Article</title></head><body><h1>Hello</h1><p>This is NERO reading.</p><script>alert(1);</script></body></html>"
    title, clean_text = tool._clean_html(sample_html)
    assert title == "Test Article"
    assert "This is NERO reading." in clean_text
    assert "alert(1)" not in clean_text


@pytest.mark.asyncio
async def test_git_analyzer_tool():
    tool = GitAnalyzerTool()
    res = await tool.execute({"action": "status", "repo_path": "."})
    assert res.success is True
    assert "branch" in res.output
    assert "is_clean" in res.output
    assert "changed_files" in res.output

    # Commit history
    log_res = await tool.execute({"action": "log", "repo_path": ".", "limit": 3})
    assert log_res.success is True
    assert "commits" in log_res.output
    assert len(log_res.output["commits"]) > 0


@pytest.mark.asyncio
async def test_project_structure_tool():
    tool = ProjectStructureTool()
    res = await tool.execute({"path": ".", "max_depth": 2})
    assert res.success is True
    assert "tech_stack" in res.output
    assert "total_files" in res.output
    assert res.output["total_files"] > 10
    assert "Python" in res.output["tech_stack"]


@pytest.mark.asyncio
async def test_task_manager_tool_lifecycle():
    tool = TaskManagerTool()

    # 1. Create task
    c_res = await tool.execute({
        "action": "create_task",
        "title": "Build Phase 6 companion features",
        "priority": "high",
        "description": "Implement developer, research, and productivity tools",
    })
    assert c_res.success is True
    task_id = c_res.output["id"]

    # 2. List tasks
    l_res = await tool.execute({"action": "list_tasks", "status_filter": "pending"})
    assert l_res.success is True
    found = any(t["id"] == task_id for t in l_res.output["tasks"])
    assert found is True

    # 3. Daily briefing
    b_res = await tool.execute({"action": "daily_briefing"})
    assert b_res.success is True
    assert "briefing" in b_res.output
    assert b_res.output["pending_count"] >= 1

    # 4. Complete task
    comp_res = await tool.execute({"action": "complete_task", "task_id": task_id})
    assert comp_res.success is True
    assert comp_res.output["status"] == "completed"

    # 5. Delete task
    del_res = await tool.execute({"action": "delete_task", "task_id": task_id})
    assert del_res.success is True


@pytest.mark.asyncio
async def test_tool_intent_detector_phase6():
    # Web search
    intent = ToolIntentDetector.detect("Search the web for latest AI news")
    assert intent is not None
    assert intent[0] == "web_search"
    assert "latest ai news" in intent[1]["query"]

    # Web reader
    intent = ToolIntentDetector.detect("Read url https://docs.python.org/3/library")
    assert intent is not None
    assert intent[0] == "web_reader"
    assert intent[1]["url"] == "https://docs.python.org/3/library"

    # Git analyzer
    intent = ToolIntentDetector.detect("NERO, check git status")
    assert intent is not None
    assert intent[0] == "git_analyzer"

    # Project structure
    intent = ToolIntentDetector.detect("Can you analyze this project structure?")
    assert intent is not None
    assert intent[0] == "project_structure"

    # Daily briefing
    intent = ToolIntentDetector.detect("Give me my daily briefing")
    assert intent is not None
    assert intent[0] == "task_manager"
    assert intent[1]["action"] == "daily_briefing"

    # Task creation
    intent = ToolIntentDetector.detect("Remind me to update documentation")
    assert intent is not None
    assert intent[0] == "task_manager"
    assert intent[1]["action"] == "create_task"
    assert "update documentation" in intent[1]["title"]


@pytest.mark.asyncio
async def test_productivity_api_endpoints():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Create project
        p_res = await client.post(
            "/api/productivity/projects",
            json={"name": "NERO Companion", "description": "AI Desktop Assistant", "root_path": "D:/Nero"},
        )
        assert p_res.status_code == 200
        p_data = p_res.json()
        assert p_data["success"] is True
        proj_id = p_data["project"]["id"]

        # 2. List projects
        p_list = await client.get("/api/productivity/projects")
        assert p_list.status_code == 200
        assert any(p["id"] == proj_id for p in p_list.json()["projects"])

        # 3. Create task linked to project
        t_res = await client.post(
            "/api/productivity/tasks",
            json={"title": "Test task for Phase 6", "priority": "urgent", "project_id": proj_id},
        )
        assert t_res.status_code == 200
        t_data = t_res.json()
        task_id = t_data["task"]["id"]

        # 4. Patch task
        patch_res = await client.patch(
            f"/api/productivity/tasks/{task_id}",
            json={"status": "completed"},
        )
        assert patch_res.status_code == 200
        assert patch_res.json()["task"]["status"] == "completed"

        # 5. Daily briefing endpoint
        brief_res = await client.get("/api/productivity/briefing")
        assert brief_res.status_code == 200
        b_data = brief_res.json()
        assert "greeting" in b_data
        assert "formatted_date" in b_data

        # 6. Delete task & project
        d_task = await client.delete(f"/api/productivity/tasks/{task_id}")
        assert d_task.status_code == 200

        d_proj = await client.delete(f"/api/productivity/projects/{proj_id}")
        assert d_proj.status_code == 200
