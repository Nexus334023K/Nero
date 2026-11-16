import os
import shutil
import tempfile
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.database.init_db import init_database
from app.main import app
from app.tools.base import PermissionLevel
from app.tools.desktop.app_launcher import AppLauncherTool
from app.tools.desktop.file_manager import FileManagerTool
from app.tools.desktop.system_monitor import SystemMonitorTool
from app.tools.desktop.volume_control import VolumeControlTool
from app.tools.intent import ToolIntentDetector
from app.tools.permissions import PermissionManager
from app.tools.registry import ToolRegistry


@pytest_asyncio.fixture(autouse=True)
async def setup_db():
    await init_database()


@pytest.mark.asyncio
async def test_system_monitor_stats():
    tool = SystemMonitorTool()
    stats = tool.get_quick_stats()
    assert "cpu_percent" in stats
    assert "memory" in stats
    assert "total_gb" in stats["memory"]
    assert "percent" in stats["memory"]
    assert "uptime" in stats
    assert "platform" in stats

    result = await tool.execute({"metrics": ["all"]})
    assert result.success is True
    assert result.action_taken == "read_system_telemetry"
    assert "summary" in result.metadata


@pytest.mark.asyncio
async def test_app_launcher_tool():
    tool = AppLauncherTool()
    apps = tool.get_available_apps()
    assert len(apps) > 0
    app_ids = [a["id"] for a in apps]
    assert "notepad" in app_ids
    assert "calculator" in app_ids

    # Validation
    valid, err = tool.validate_params({"app_name": "notepad"})
    assert valid is True

    valid, err = tool.validate_params({})
    assert valid is False

    valid, err = tool.validate_params({"custom_path": "non_existent_binary_xyz.exe"})
    assert valid is False


@pytest.mark.asyncio
async def test_file_manager_crud_and_traversal_guards():
    tool = FileManagerTool()
    temp_dir = tempfile.mkdtemp(prefix="nero_test_fm_")

    try:
        # 1. Path traversal guard
        safe, err = tool._is_path_safe(r"C:\Windows\System32\cmd.exe")
        assert safe is False
        assert "prohibited" in err

        # 2. Create file
        test_file = os.path.join(temp_dir, "hello.txt")
        res_create = await tool.execute({
            "action": "create_file",
            "path": test_file,
            "content": "Hello NERO automation!",
        })
        assert res_create.success is True
        assert os.path.exists(test_file)

        # 3. Read file
        res_read = await tool.execute({
            "action": "read_file",
            "path": test_file,
        })
        assert res_read.success is True
        assert res_read.output["content"] == "Hello NERO automation!"

        # 4. Create folder
        subfolder = os.path.join(temp_dir, "sub_dir")
        res_folder = await tool.execute({
            "action": "create_folder",
            "path": subfolder,
        })
        assert res_folder.success is True
        assert os.path.isdir(subfolder)

        # 5. List directory
        res_list = await tool.execute({
            "action": "list_dir",
            "path": temp_dir,
        })
        assert res_list.success is True
        assert res_list.output["total_listed"] >= 2

        # 6. Delete file
        res_del = await tool.execute({
            "action": "delete_file",
            "path": test_file,
        })
        assert res_del.success is True
        assert not os.path.exists(test_file)

    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


@pytest.mark.asyncio
async def test_volume_control_tool():
    tool = VolumeControlTool()

    valid, _ = tool.validate_params({"action": "get_volume"})
    assert valid is True

    valid, _ = tool.validate_params({"action": "set_volume", "level": 45})
    assert valid is True

    valid, _ = tool.validate_params({"action": "set_volume", "level": 150})
    assert valid is False

    result = await tool.execute({"action": "get_volume"})
    assert result.success is True
    assert "level" in result.output


@pytest.mark.asyncio
async def test_permission_manager_lifecycle():
    pm = PermissionManager()

    # Create approval
    req = pm.create_approval_request(
        tool_name="file_manager",
        params={"action": "delete_file", "path": "D:/test.txt"},
        reason="Confirm deletion of test file",
        permission_level="explicit_confirmation",
    )
    token = req["token"]
    assert token.startswith("tok_")

    # Get approval
    appr = pm.get_approval(token)
    assert appr is not None
    assert appr.status == "pending"

    # Resolve approval with allow_once
    ok, err, resolved = await pm.resolve_approval(token, "allow_once")
    assert ok is True
    assert resolved.status == "approved"

    # Cannot resolve already resolved token
    ok2, err2, _ = await pm.resolve_approval(token, "deny")
    assert ok2 is False


@pytest.mark.asyncio
async def test_tool_intent_detector():
    # System telemetry
    intent = ToolIntentDetector.detect("What is my current CPU and RAM usage?")
    assert intent is not None
    assert intent[0] == "system_monitor"

    # App launcher
    intent = ToolIntentDetector.detect("NERO, please open notepad")
    assert intent is not None
    assert intent[0] == "launch_application"
    assert intent[1]["app_name"] == "notepad"

    intent = ToolIntentDetector.detect("Can you open calculator for me?")
    assert intent is not None
    assert intent[0] == "launch_application"
    assert intent[1]["app_name"] == "calculator"

    # Volume control
    intent = ToolIntentDetector.detect("Set volume to 60")
    assert intent is not None
    assert intent[0] == "volume_control"
    assert intent[1]["level"] == 60

    intent = ToolIntentDetector.detect("Mute the sound")
    assert intent is not None
    assert intent[0] == "volume_control"
    assert intent[1]["action"] == "mute"

    # Non tool general query
    intent = ToolIntentDetector.detect("Tell me a story about space exploration")
    assert intent is None


@pytest.mark.asyncio
async def test_tools_api_endpoints():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. List tools
        res = await client.get("/api/tools")
        assert res.status_code == 200
        data = res.json()
        assert "tools" in data
        tool_names = [t["name"] for t in data["tools"]]
        assert "system_monitor" in tool_names
        assert "launch_application" in tool_names
        assert "file_manager" in tool_names
        assert "volume_control" in tool_names

        # 2. System stats
        stats_res = await client.get("/api/tools/system/stats")
        assert stats_res.status_code == 200
        stats_data = stats_res.json()
        assert "cpu_percent" in stats_data
        assert "memory" in stats_data

        # 3. Available apps
        apps_res = await client.get("/api/tools/apps")
        assert apps_res.status_code == 200
        assert "apps" in apps_res.json()

        # 4. Execute system_monitor (auto permission)
        exec_res = await client.post(
            "/api/tools/execute",
            json={"tool_name": "system_monitor", "params": {"metrics": ["all"]}},
        )
        assert exec_res.status_code == 200
        exec_data = exec_res.json()
        assert exec_data["status"] == "success"
        assert exec_data["result"]["success"] is True

        # 5. Execute guarded tool without token -> requires approval
        guarded_res = await client.post(
            "/api/tools/execute",
            json={
                "tool_name": "file_manager",
                "params": {"action": "delete_file", "path": "C:/fake/path.txt"},
            },
        )
        assert guarded_res.status_code == 200
        guarded_data = guarded_res.json()
        assert guarded_data["status"] == "approval_required"
        assert "token" in guarded_data["approval"]
        approval_token = guarded_data["approval"]["token"]

        # 6. Deny approval
        deny_res = await client.post(
            "/api/tools/approve",
            json={"token": approval_token, "decision": "deny"},
        )
        assert deny_res.status_code == 200
        assert deny_res.json()["status"] == "denied"
