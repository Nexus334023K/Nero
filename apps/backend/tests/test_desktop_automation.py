import os
from pathlib import Path
import shutil
import tempfile
import pytest

from app.tools.registry import tool_registry
from app.tools.desktop.computer_control import ComputerControlTool
from app.tools.desktop.system_control import SystemControlTool
from app.tools.desktop.file_manager import FileManagerTool
from app.tools.desktop.app_launcher import AppLauncherTool
from app.tools.productivity.office_automation import OfficeAutomationTool
from app.tools.creative.creative_tools import CreativeSuiteTool
from app.tools.intent import ToolIntentDetector
from app.engine.action_planner import AutonomousActionPlanner


@pytest.mark.asyncio
async def test_tool_registry_contains_new_tools():
    """Verify all new desktop automation tools are registered in tool_registry."""
    tools = tool_registry.list_tools()
    tool_names = {t["name"] for t in tools}

    assert "computer_control" in tool_names
    assert "system_control" in tool_names
    assert "launch_application" in tool_names
    assert "file_manager" in tool_names
    assert "office_automation" in tool_names
    assert "browser_automation" in tool_names
    assert "creative_suite" in tool_names


@pytest.mark.asyncio
async def test_computer_control_tool():
    """Test keyboard, mouse, and window inspection operations."""
    tool = ComputerControlTool()

    # Active window
    res_active = await tool.execute({"action": "get_active_window"})
    assert res_active.success is True
    assert "title" in res_active.output

    # Find windows
    res_find = await tool.execute({"action": "find_windows", "window_title": ""})
    assert res_find.success is True
    assert isinstance(res_find.output["windows"], list)

    # Press key
    res_key = await tool.execute({"action": "press_key", "key": "shift"})
    assert res_key.success is True

    # Hotkey
    res_hotkey = await tool.execute({"action": "hotkey", "keys": ["ctrl"]})
    assert res_hotkey.success is True


@pytest.mark.asyncio
async def test_system_control_tool():
    """Test telemetry, clipboard, process listing, and screenshot capture."""
    tool = SystemControlTool()

    # Telemetry
    res_info = await tool.execute({"action": "get_system_info"})
    assert res_info.success is True
    assert "cpu_percent" in res_info.output
    assert "ram_percent" in res_info.output
    assert "disk_percent" in res_info.output

    # Running processes
    res_proc = await tool.execute({"action": "get_running_processes"})
    assert res_proc.success is True
    assert len(res_proc.output["processes"]) > 0

    # Clipboard set & get
    test_text = "Nero Autonomous AI Companion"
    res_set_clip = await tool.execute({"action": "set_clipboard", "text": test_text})
    assert res_set_clip.success is True

    res_get_clip = await tool.execute({"action": "get_clipboard"})
    assert res_get_clip.success is True
    assert res_get_clip.output["content"] == test_text

    # Screenshot
    res_shot = await tool.execute({"action": "take_screenshot", "screenshot_filename": "test_shot.png"})
    assert res_shot.success is True
    assert Path(res_shot.output["path"]).exists()
    # Cleanup test screenshot
    try:
        Path(res_shot.output["path"]).unlink()
    except Exception:
        pass


@pytest.mark.asyncio
async def test_file_manager_extended():
    """Test comprehensive file and folder operations: create, edit, search, organize, archive."""
    tool = FileManagerTool()
    temp_dir = Path(tempfile.mkdtemp(prefix="nero_test_"))

    try:
        # Create folder
        sub_folder = temp_dir / "SubDir"
        res_folder = await tool.execute({"action": "create_folder", "path": str(sub_folder)})
        assert res_folder.success is True
        assert sub_folder.exists()

        # Create file
        file1 = sub_folder / "test.txt"
        res_file = await tool.execute({"action": "create_file", "path": str(file1), "content": "Hello Nero"})
        assert res_file.success is True
        assert file1.exists()

        # Read file
        res_read = await tool.execute({"action": "read_file", "path": str(file1)})
        assert res_read.success is True
        assert res_read.output["content"] == "Hello Nero"

        # Edit file (append)
        res_edit = await tool.execute({"action": "edit_file", "path": str(file1), "content": " More Content", "mode": "append"})
        assert res_edit.success is True
        assert file1.read_text(encoding="utf-8") == "Hello Nero More Content"

        # Copy file
        file2 = sub_folder / "test_copy.txt"
        res_copy = await tool.execute({"action": "copy", "path": str(file1), "destination": str(file2)})
        assert res_copy.success is True
        assert file2.exists()

        # Search files
        res_search = await tool.execute({"action": "search_files", "path": str(temp_dir), "pattern": "*.txt"})
        assert res_search.success is True
        assert len(res_search.output["matches"]) >= 2

        # Create archive
        zip_file = temp_dir / "archive.zip"
        res_zip = await tool.execute({"action": "create_archive", "path": str(sub_folder), "destination": str(zip_file)})
        assert res_zip.success is True
        assert zip_file.exists()

        # Extract archive
        extract_dir = temp_dir / "Extracted"
        res_extract = await tool.execute({"action": "extract_archive", "path": str(zip_file), "destination": str(extract_dir)})
        assert res_extract.success is True
        assert extract_dir.exists()

        # Folder organization
        organize_target = temp_dir / "ToOrganize"
        organize_target.mkdir()
        (organize_target / "notes.txt").write_text("notes", encoding="utf-8")
        (organize_target / "pic.png").write_bytes(b"\x89PNG")
        res_org = await tool.execute({"action": "organize_folder", "path": str(organize_target)})
        assert res_org.success is True
        assert (organize_target / "Documents" / "notes.txt").exists()
        assert (organize_target / "Images" / "pic.png").exists()

    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


@pytest.mark.asyncio
async def test_office_automation_tool():
    """Test DOCX, XLSX, and PPTX document generation."""
    tool = OfficeAutomationTool()
    temp_dir = Path(tempfile.mkdtemp(prefix="nero_office_"))

    try:
        # Create Word Document
        docx_file = temp_dir / "Report.docx"
        res_doc = await tool.execute({
            "action": "create_document",
            "file_path": str(docx_file),
            "title": "Autonomous AI Report",
            "sections": [
                {"heading": "Summary", "content": "Autonomous desktop companion execution."},
                {"heading": "Findings", "bullets": ["Task completed", "Output verified"]},
            ],
        })
        assert res_doc.success is True
        assert docx_file.exists()
        assert docx_file.stat().st_size > 0

        # Create Excel Spreadsheet
        xlsx_file = temp_dir / "Data.xlsx"
        res_sheet = await tool.execute({
            "action": "create_spreadsheet",
            "file_path": str(xlsx_file),
            "headers": ["Task", "Status", "Duration_ms"],
            "rows": [
                ["Notepad Launch", "Success", 120],
                ["Text Entry", "Verified", 250],
            ],
        })
        assert res_sheet.success is True
        assert xlsx_file.exists()
        assert xlsx_file.stat().st_size > 0

        # Create PowerPoint Presentation
        pptx_file = temp_dir / "Slides.pptx"
        res_ppt = await tool.execute({
            "action": "create_presentation",
            "file_path": str(pptx_file),
            "title": "Nero Architecture",
            "sections": [
                {"heading": "Milestones", "bullets": ["Desktop Control", "File Automation", "Productivity"]},
            ],
        })
        assert res_ppt.success is True
        assert pptx_file.exists()
        assert pptx_file.stat().st_size > 0

    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


@pytest.mark.asyncio
async def test_autonomous_action_planner():
    """Test natural language goal decomposition into verified action plans."""
    # Pattern 1: Notepad
    plan1 = AutonomousActionPlanner.plan("Open Notepad and type hello world.")
    assert plan1 is not None
    assert len(plan1.steps) == 3
    assert plan1.steps[0].tool_name == "launch_application"
    assert plan1.steps[1].tool_name == "computer_control"
    assert plan1.steps[2].tool_name == "computer_control"
    assert plan1.steps[2].params["text"] == "hello world"

    # Pattern 2: Calculator
    plan2 = AutonomousActionPlanner.plan("Open Calculator and calculate 25 multiplied by 4.")
    assert plan2 is not None
    assert any("calc" in s.params.get("app_name", "") for s in plan2.steps)
    assert any("25*4=" in s.params.get("text", "") for s in plan2.steps)

    # Pattern 3: Desktop Folder
    plan3 = AutonomousActionPlanner.plan("Create a folder on my Desktop called Nero Projects.")
    assert plan3 is not None
    assert plan3.steps[0].tool_name == "file_manager"
    assert plan3.steps[0].params["action"] == "create_folder"
    assert "Nero Projects" in plan3.steps[0].params["path"]

    # Pattern 4: Organize Downloads
    plan4 = AutonomousActionPlanner.plan("Organize my Downloads folder.")
    assert plan4 is not None
    assert plan4.steps[0].params["action"] == "organize_folder"

    # Execution of a safe plan
    exec_res = await AutonomousActionPlanner.execute_plan(plan3)
    assert exec_res["success"] is True
    assert "Done! I've completed your request" in exec_res["summary"]
    # Cleanup created folder on Desktop if needed
    try:
        (Path.home() / "Desktop" / "Nero Projects").rmdir()
    except Exception:
        pass


def test_tool_intent_detector():
    """Test natural language intent classification for new tools."""
    # Real Desktop Control
    res1 = ToolIntentDetector.detect("type hello from test")
    assert res1 is not None
    assert res1[0] == "computer_control"
    assert res1[1]["action"] == "type_text"

    res2 = ToolIntentDetector.detect("press enter")
    assert res2 is not None
    assert res2[0] == "computer_control"
    assert res2[1]["key"] == "enter"

    # Screenshot
    res3 = ToolIntentDetector.detect("take a screenshot")
    assert res3 is not None
    assert res3[0] == "system_control"
    assert res3[1]["action"] == "take_screenshot"

    # Clipboard
    res4 = ToolIntentDetector.detect("what is on my clipboard?")
    assert res4 is not None
    assert res4[0] == "system_control"
    assert res4[1]["action"] == "get_clipboard"
