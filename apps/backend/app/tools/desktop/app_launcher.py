import os
import shutil
import subprocess
from typing import Any, Dict, List, Optional, Tuple

from app.core.logging_config import get_logger
from app.tools.base import BaseTool, PermissionLevel, ToolResult

logger = get_logger(__name__)

# Standard known safe Windows executables and aliases
WHITELISTED_APPS: Dict[str, Dict[str, Any]] = {
    "notepad": {
        "binary": "notepad.exe",
        "name": "Notepad",
        "description": "Windows Text Editor",
        "category": "productivity",
    },
    "calculator": {
        "binary": "calc.exe",
        "name": "Calculator",
        "description": "Windows Calculator",
        "category": "utility",
    },
    "calc": {
        "binary": "calc.exe",
        "name": "Calculator",
        "description": "Windows Calculator",
        "category": "utility",
    },
    "explorer": {
        "binary": "explorer.exe",
        "name": "File Explorer",
        "description": "Windows File Explorer",
        "category": "system",
    },
    "taskmgr": {
        "binary": "taskmgr.exe",
        "name": "Task Manager",
        "description": "Windows Task Manager",
        "category": "system",
    },
    "paint": {
        "binary": "mspaint.exe",
        "name": "Paint",
        "description": "Windows Paint",
        "category": "utility",
    },
    "vscode": {
        "binary": "code",
        "name": "Visual Studio Code",
        "description": "Code Editor",
        "category": "developer",
    },
    "code": {
        "binary": "code",
        "name": "Visual Studio Code",
        "description": "Code Editor",
        "category": "developer",
    },
    "terminal": {
        "binary": "wt.exe",
        "fallback": "powershell.exe",
        "name": "Windows Terminal",
        "description": "Command Terminal",
        "category": "developer",
    },
    "powershell": {
        "binary": "powershell.exe",
        "name": "PowerShell",
        "description": "Windows PowerShell",
        "category": "developer",
    },
    "browser": {
        "binary": "default_browser",
        "name": "Web Browser",
        "description": "Default System Browser",
        "category": "browser",
    },
}


class AppLauncherTool(BaseTool):
    """Tool for launching approved Windows applications and tools safely."""

    name = "launch_application"
    description = (
        "Launch an approved Windows application (such as Notepad, Calculator, "
        "File Explorer, VS Code, Browser, or configured app)."
    )
    permission_level = PermissionLevel.AUTO
    parameters_schema = {
        "type": "object",
        "properties": {
            "app_name": {
                "type": "string",
                "description": "Name or alias of application (e.g. 'notepad', 'calculator', 'explorer', 'vscode', 'browser').",
            },
            "custom_path": {
                "type": "string",
                "description": "Optional path to a custom application executable.",
            },
            "arguments": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Optional list of command line arguments for the application.",
            },
        },
        "required": ["app_name"],
    }

    def get_available_apps(self) -> List[Dict[str, Any]]:
        """Return list of supported whitelisted applications."""
        seen = set()
        apps = []
        for key, info in WHITELISTED_APPS.items():
            if info["binary"] not in seen:
                seen.add(info["binary"])
                apps.append({
                    "id": key,
                    "name": info["name"],
                    "description": info["description"],
                    "category": info["category"],
                    "is_installed": self._is_available(info["binary"]),
                })
        return apps

    def _is_available(self, binary: str) -> bool:
        if binary == "default_browser":
            return True
        return shutil.which(binary) is not None

    def validate_params(self, params: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        app_name = params.get("app_name", "").strip().lower()
        custom_path = params.get("custom_path")

        if not app_name and not custom_path:
            return False, "Either 'app_name' or 'custom_path' must be provided."

        if custom_path:
            norm = os.path.normpath(custom_path)
            if not os.path.isfile(norm):
                return False, f"Custom executable not found at '{norm}'."
            if not norm.lower().endswith((".exe", ".bat", ".cmd")):
                return False, "Custom file must be an executable (.exe, .cmd, .bat)."

        return True, None

    async def execute(self, params: Dict[str, Any]) -> ToolResult:
        app_key = params.get("app_name", "").strip().lower()
        custom_path = params.get("custom_path")
        args: List[str] = params.get("arguments", []) or []

        try:
            if custom_path:
                target_exe = os.path.normpath(custom_path)
                display_name = os.path.basename(target_exe)
                cmd = [target_exe] + [str(a) for a in args]
                proc = subprocess.Popen(cmd, shell=False)
                return ToolResult(
                    success=True,
                    action_taken=f"Launched custom application '{display_name}'",
                    output={"pid": proc.pid, "executable": target_exe},
                )

            if app_key not in WHITELISTED_APPS:
                # Try generic which
                resolved = shutil.which(app_key)
                if not resolved:
                    return ToolResult(
                        success=False,
                        action_taken="launch_application",
                        error=f"Application '{app_key}' is not in approved whitelist and not found in system PATH.",
                    )
                target_exe = resolved
                display_name = app_key
            else:
                app_info = WHITELISTED_APPS[app_key]
                display_name = app_info["name"]
                binary = app_info["binary"]

                if binary == "default_browser":
                    import webbrowser
                    url = args[0] if args else "https://google.com"
                    webbrowser.open(url)
                    return ToolResult(
                        success=True,
                        action_taken=f"Opened default browser to {url}",
                        output={"url": url},
                    )

                target_exe = shutil.which(binary)
                if not target_exe:
                    fallback = app_info.get("fallback")
                    if fallback:
                        target_exe = shutil.which(fallback)
                    if not target_exe:
                        target_exe = binary  # Fallback to direct name for Windows system binaries

            # Execute without shell injection risk (shell=False)
            cmd = [target_exe] + [str(a) for a in args]
            proc = subprocess.Popen(cmd, shell=False)

            logger.info("Successfully launched application %s (PID: %d)", display_name, proc.pid)
            return ToolResult(
                success=True,
                action_taken=f"Launched '{display_name}' successfully",
                output={"pid": proc.pid, "executable": target_exe, "name": display_name},
            )

        except Exception as e:
            logger.error("Failed to launch application %s: %s", app_key, e)
            return ToolResult(
                success=False,
                action_taken="launch_application",
                error=f"Failed to launch application: {str(e)}",
            )
