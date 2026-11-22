import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import time
from typing import Any, Dict, List, Optional, Tuple

from app.core.logging_config import get_logger
from app.tools.base import BaseTool, PermissionLevel, ToolResult

logger = get_logger(__name__)

COMMON_ADOBE_PATHS: Dict[str, List[str]] = {
    "after_effects": [
        r"C:\Program Files\Adobe\Adobe After Effects 2024\Support Files\AfterFX.exe",
        r"C:\Program Files\Adobe\Adobe After Effects 2025\Support Files\AfterFX.exe",
        r"C:\Program Files\Adobe\Adobe After Effects 2023\Support Files\AfterFX.exe",
    ],
    "premiere": [
        r"C:\Program Files\Adobe\Adobe Premiere Pro 2024\Adobe Premiere Pro.exe",
        r"C:\Program Files\Adobe\Adobe Premiere Pro 2025\Adobe Premiere Pro.exe",
        r"C:\Program Files\Adobe\Adobe Premiere Pro 2023\Adobe Premiere Pro.exe",
    ],
    "photoshop": [
        r"C:\Program Files\Adobe\Adobe Photoshop 2024\Photoshop.exe",
        r"C:\Program Files\Adobe\Adobe Photoshop 2025\Photoshop.exe",
        r"C:\Program Files\Adobe\Adobe Photoshop 2023\Photoshop.exe",
    ],
}


class CreativeSuiteTool(BaseTool):
    """Automation tool for Adobe Creative Cloud (After Effects, Premiere, Photoshop) and VS Code."""

    name = "creative_suite"
    description = (
        "Automate creative applications: After Effects (open project, create compositions, render), "
        "Premiere Pro, Photoshop (open images/PSD, run actions), and Visual Studio Code."
    )
    permission_level = PermissionLevel.AUTO
    parameters_schema = {
        "type": "object",
        "properties": {
            "app": {
                "type": "string",
                "enum": ["after_effects", "premiere", "photoshop", "vscode"],
                "description": "Creative application target.",
            },
            "action": {
                "type": "string",
                "enum": [
                    "launch",
                    "open_project",
                    "create_composition",
                    "run_script",
                    "check_installed",
                ],
                "description": "Operation to perform.",
            },
            "project_path": {
                "type": "string",
                "description": "Path to project file (.aep, .prproj, .psd, or directory for VS Code).",
            },
            "composition_name": {
                "type": "string",
                "default": "Comp 1",
                "description": "Name for new composition in After Effects.",
            },
            "width": {"type": "integer", "default": 1920},
            "height": {"type": "integer", "default": 1080},
            "duration_seconds": {"type": "number", "default": 10.0},
            "fps": {"type": "number", "default": 30.0},
            "script_code": {
                "type": "string",
                "description": "Optional ExtendScript (JSX) code to run inside After Effects or Photoshop.",
            },
        },
        "required": ["app", "action"],
    }

    def _find_binary(self, app_key: str) -> Optional[str]:
        if app_key == "vscode":
            return shutil.which("code")

        candidates = COMMON_ADOBE_PATHS.get(app_key, [])
        for c in candidates:
            if os.path.isfile(c):
                return c

        which_res = shutil.which(f"{app_key}.exe")
        if which_res:
            return which_res

        return None

    def validate_params(self, params: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        app_key = params.get("app")
        action = params.get("action")
        if not app_key or not action:
            return False, "Both 'app' and 'action' are required."
        if action == "open_project" and not params.get("project_path"):
            return False, "Action 'open_project' requires 'project_path'."
        return True, None

    async def execute(self, params: Dict[str, Any]) -> ToolResult:
        app_key = params["app"]
        action = params["action"]
        binary = self._find_binary(app_key)

        try:
            if action == "check_installed":
                return ToolResult(
                    success=True,
                    action_taken="check_installed",
                    output={
                        "app": app_key,
                        "installed": binary is not None,
                        "binary_path": binary,
                    },
                )

            if action == "launch":
                if not binary:
                    return ToolResult(
                        success=False,
                        action_taken="launch",
                        error=f"Could not locate executable for '{app_key}'. Please ensure it is installed.",
                    )
                proc = subprocess.Popen([binary], shell=False)
                return ToolResult(
                    success=True,
                    action_taken=f"Launched {app_key}",
                    output={"pid": proc.pid, "binary": binary},
                )

            elif action == "open_project":
                project_path = Path(params["project_path"]).resolve()
                if not project_path.exists():
                    return ToolResult(success=False, action_taken="open_project", error=f"File not found: {project_path}")

                if binary:
                    proc = subprocess.Popen([binary, str(project_path)], shell=False)
                    return ToolResult(
                        success=True,
                        action_taken=f"Opened project in {app_key}",
                        output={"path": str(project_path), "pid": proc.pid},
                    )
                else:
                    # Windows file association fallback
                    os.startfile(str(project_path))
                    return ToolResult(
                        success=True,
                        action_taken=f"Opened project via Windows file association",
                        output={"path": str(project_path)},
                    )

            elif action == "create_composition" and app_key == "after_effects":
                comp_name = params.get("composition_name", "Comp 1")
                w = int(params.get("width", 1920))
                h = int(params.get("height", 1080))
                dur = float(params.get("duration_seconds", 10.0))
                fps = float(params.get("fps", 30.0))

                jsx_script = f"""
                app.beginUndoGroup("Create Nero Composition");
                var project = app.project || app.newProject();
                var comp = project.items.addComp("{comp_name}", {w}, {h}, 1.0, {dur}, {fps});
                app.endUndoGroup();
                """
                return await self._run_jsx(binary, jsx_script, f"Created composition '{comp_name}' ({w}x{h}, {dur}s)")

            elif action == "run_script":
                code = params.get("script_code", "")
                if not code:
                    return ToolResult(success=False, action_taken="run_script", error="script_code is empty")
                return await self._run_jsx(binary, code, "Executed custom ExtendScript")

            else:
                return ToolResult(success=False, action_taken=action, error=f"Action '{action}' not supported for '{app_key}'")

        except Exception as e:
            logger.error("CreativeSuiteTool error on '%s': %s", action, e)
            return ToolResult(success=False, action_taken=action, error=str(e))

    async def _run_jsx(self, binary: Optional[str], jsx_code: str, description: str) -> ToolResult:
        if not binary:
            return ToolResult(
                success=False,
                action_taken="run_script",
                error="Adobe After Effects / Photoshop executable not found on this machine.",
            )

        with tempfile.NamedTemporaryFile("w", suffix=".jsx", delete=False, encoding="utf-8") as f:
            f.write(jsx_code)
            tmp_jsx = f.name

        try:
            cmd = [binary, "-r", tmp_jsx]
            proc = subprocess.Popen(cmd, shell=False)
            time.sleep(0.5)
            return ToolResult(
                success=True,
                action_taken=description,
                output={"jsx_file": tmp_jsx, "pid": proc.pid},
            )
        finally:
            pass
