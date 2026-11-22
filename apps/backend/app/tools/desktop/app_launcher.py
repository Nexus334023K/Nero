import ctypes
import os
from pathlib import Path
import shutil
import subprocess
import sys
import time
from typing import Any, Dict, List, Optional, Tuple

import psutil

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
    "task_manager": {
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
    "cmd": {
        "binary": "cmd.exe",
        "name": "Command Prompt",
        "description": "Windows Command Prompt",
        "category": "developer",
    },
    "browser": {
        "binary": "default_browser",
        "name": "Web Browser",
        "description": "Default System Browser",
        "category": "browser",
    },
    "chrome": {
        "binary": "chrome.exe",
        "fallback": "default_browser",
        "name": "Google Chrome",
        "description": "Chrome Web Browser",
        "category": "browser",
    },
    "edge": {
        "binary": "msedge.exe",
        "fallback": "default_browser",
        "name": "Microsoft Edge",
        "description": "Edge Web Browser",
        "category": "browser",
    },
    "word": {
        "binary": "WINWORD.EXE",
        "name": "Microsoft Word",
        "description": "Word Processor",
        "category": "productivity",
    },
    "excel": {
        "binary": "EXCEL.EXE",
        "name": "Microsoft Excel",
        "description": "Spreadsheet Application",
        "category": "productivity",
    },
    "powerpoint": {
        "binary": "POWERPNT.EXE",
        "name": "Microsoft PowerPoint",
        "description": "Presentation Software",
        "category": "productivity",
    },
    "after_effects": {
        "binary": "AfterFX.exe",
        "name": "Adobe After Effects",
        "description": "Visual Effects & Motion Graphics",
        "category": "creative",
    },
    "aftereffects": {
        "binary": "AfterFX.exe",
        "name": "Adobe After Effects",
        "description": "Visual Effects & Motion Graphics",
        "category": "creative",
    },
    "premiere": {
        "binary": "Adobe Premiere Pro.exe",
        "name": "Adobe Premiere Pro",
        "description": "Video Editing Software",
        "category": "creative",
    },
    "premiere_pro": {
        "binary": "Adobe Premiere Pro.exe",
        "name": "Adobe Premiere Pro",
        "description": "Video Editing Software",
        "category": "creative",
    },
    "photoshop": {
        "binary": "Photoshop.exe",
        "name": "Adobe Photoshop",
        "description": "Image Editing Software",
        "category": "creative",
    },
    "spotify": {
        "binary": "Spotify.exe",
        "name": "Spotify",
        "description": "Music & Podcast Player",
        "category": "media",
    },
}


class AppLauncherTool(BaseTool):
    """Tool for launching, finding, switching, and managing Windows applications and files."""

    name = "launch_application"
    description = (
        "Launch applications, find installed apps, inspect running applications, "
        "switch between apps, open files with associated apps, and close applications."
    )
    permission_level = PermissionLevel.AUTO

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
    parameters_schema = {
        "type": "object",
        "properties": {
            "action": {
                "type": "string",
                "enum": ["launch", "find_installed", "get_running", "switch_to", "close", "open_file"],
                "default": "launch",
                "description": "Application management operation to perform.",
            },
            "app_name": {
                "type": "string",
                "description": "Name or alias of application (e.g. 'notepad', 'calculator', 'chrome', 'vscode', 'explorer').",
            },
            "custom_path": {
                "type": "string",
                "description": "Optional path to a custom application executable.",
            },
            "file_path": {
                "type": "string",
                "description": "Path to a document or file to open with its associated default application.",
            },
            "arguments": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Optional command line arguments for the application.",
            },
        },
    }

    def validate_params(self, params: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        action = params.get("action", "launch")
        app_name = params.get("app_name", "").strip().lower()
        custom_path = params.get("custom_path")
        file_path = params.get("file_path")

        if action in ("launch", "switch_to", "close"):
            if not app_name and not custom_path:
                return False, "Either 'app_name' or 'custom_path' must be provided."

        if action == "open_file" and not file_path:
            return False, "Action 'open_file' requires 'file_path'."

        if custom_path:
            norm = os.path.normpath(custom_path)
            if not os.path.isfile(norm):
                return False, f"Custom executable not found at '{norm}'."
            if not norm.lower().endswith((".exe", ".bat", ".cmd", ".lnk")):
                return False, "Custom file must be an executable (.exe, .cmd, .bat, .lnk)."

        return True, None

    async def execute(self, params: Dict[str, Any]) -> ToolResult:
        action = params.get("action", "launch")

        try:
            if action == "launch":
                return await self._launch_app(
                    app_key=params.get("app_name", "").strip().lower(),
                    custom_path=params.get("custom_path"),
                    args=params.get("arguments", []) or [],
                )
            elif action == "find_installed":
                return self._find_installed_apps(params.get("app_name"))
            elif action == "get_running":
                return self._get_running_apps(params.get("app_name"))
            elif action == "switch_to":
                return await self._switch_to_app(params.get("app_name", ""))
            elif action == "close":
                return await self._close_app(params.get("app_name", ""))
            elif action == "open_file":
                return self._open_file(params.get("file_path", ""))
            else:
                return ToolResult(
                    success=False,
                    action_taken=action,
                    error=f"Unsupported action: '{action}'",
                )
        except Exception as e:
            logger.error("AppLauncherTool error on '%s': %s", action, e)
            return ToolResult(
                success=False,
                action_taken=action,
                error=f"Application management error: {str(e)}",
            )

    async def _launch_app(self, app_key: str, custom_path: Optional[str], args: List[str]) -> ToolResult:
        if custom_path:
            target_exe = os.path.normpath(custom_path)
            display_name = os.path.basename(target_exe)
            cmd = [target_exe] + [str(a) for a in args]
            proc = subprocess.Popen(cmd, shell=False)
            time.sleep(0.3)
            return ToolResult(
                success=True,
                action_taken="launch_application",
                output={"pid": proc.pid, "executable": target_exe, "name": display_name, "verified": True},
            )

        if app_key not in WHITELISTED_APPS:
            resolved = shutil.which(app_key)
            if not resolved:
                # Search Start Menu / Common Programs
                installed = self._find_installed_apps(app_key)
                if installed.output and installed.output.get("apps"):
                    first_match = installed.output["apps"][0]
                    target_exe = first_match["path"]
                    display_name = first_match["name"]
                else:
                    return ToolResult(
                        success=False,
                        action_taken="launch_application",
                        error=f"Application '{app_key}' not found in PATH or standard Windows installed locations.",
                    )
            else:
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
                    action_taken="launch_application",
                    output={"url": url, "name": "Default Browser", "verified": True},
                )

            target_exe = shutil.which(binary)
            if not target_exe:
                fallback = app_info.get("fallback")
                if fallback:
                    if fallback == "default_browser":
                        import webbrowser
                        url = args[0] if args else "https://google.com"
                        webbrowser.open(url)
                        return ToolResult(success=True, action_taken="launch_application", output={"url": url, "verified": True})
                    target_exe = shutil.which(fallback)
                if not target_exe:
                    target_exe = binary  # Fallback to direct name for Windows system binaries

        cmd = [target_exe] + [str(a) for a in args]
        proc = subprocess.Popen(cmd, shell=False)
        time.sleep(0.4)

        # Verification: check if process is running
        is_running = proc.poll() is None
        return ToolResult(
            success=is_running,
            action_taken="launch_application",
            output={"pid": proc.pid, "executable": target_exe, "name": display_name, "verified": is_running},
        )

    def _find_installed_apps(self, query: Optional[str] = None) -> ToolResult:
        """Scan Windows Start Menu and common directories for installed apps."""
        results: List[Dict[str, str]] = []
        search_dirs = [
            Path(r"C:\ProgramData\Microsoft\Windows\Start Menu\Programs"),
            Path(os.environ.get("APPDATA", "")) / r"Microsoft\Windows\Start Menu\Programs",
            Path(r"C:\Program Files"),
            Path(r"C:\Program Files (x86)"),
        ]

        q_lower = query.lower().strip() if query else None

        for base_dir in search_dirs:
            if not base_dir.exists():
                continue
            for root, _, files in os.walk(base_dir):
                for f in files:
                    if f.lower().endswith((".lnk", ".exe")):
                        stem = Path(f).stem
                        if q_lower and q_lower not in stem.lower():
                            continue
                        full_path = str(Path(root) / f)
                        if not any(r["name"] == stem for r in results):
                            results.append({"name": stem, "path": full_path})
                if len(results) >= 50:
                    break

        return ToolResult(
            success=True,
            action_taken="find_installed",
            output={"count": len(results), "apps": results},
        )

    def _get_running_apps(self, filter_name: Optional[str] = None) -> ToolResult:
        running: List[Dict[str, Any]] = []
        filter_lower = filter_name.lower().strip() if filter_name else None

        for p in psutil.process_iter(["pid", "name"]):
            try:
                name = p.info["name"] or ""
                if name.lower().endswith(".exe"):
                    clean = name[:-4]
                    if filter_lower and filter_lower not in clean.lower():
                        continue
                    # Exclude core background Windows daemons
                    if clean.lower() in ["svchost", "smss", "csrss", "wininit", "services", "lsass", "conhost"]:
                        continue
                    running.append({"name": clean, "pid": p.info["pid"], "exe": name})
            except Exception:
                continue

        return ToolResult(
            success=True,
            action_taken="get_running",
            output={"count": len(running), "applications": running[:35]},
        )

    async def _switch_to_app(self, app_name: str) -> ToolResult:
        """Find open window of app and bring to front."""
        from app.tools.desktop.computer_control import ComputerControlTool
        ctrl = ComputerControlTool()
        return await ctrl.execute({"action": "focus_window", "window_title": app_name})

    async def _close_app(self, app_name: str) -> ToolResult:
        from app.tools.desktop.computer_control import ComputerControlTool
        ctrl = ComputerControlTool()
        # First try closing via window message
        res = await ctrl.execute({"action": "close_window", "window_title": app_name})
        if res.success:
            return res

        # Fallback to terminating matching process
        for p in psutil.process_iter(["pid", "name"]):
            try:
                if app_name.lower() in (p.info["name"] or "").lower():
                    p.terminate()
                    return ToolResult(
                        success=True,
                        action_taken="close",
                        output={"closed": p.info["name"], "pid": p.info["pid"]},
                    )
            except Exception:
                continue

        return ToolResult(success=False, action_taken="close", error=f"No running process or window found for '{app_name}'.")

    def _open_file(self, file_path: str) -> ToolResult:
        p = Path(file_path).resolve()
        if not p.exists():
            return ToolResult(success=False, action_taken="open_file", error=f"File not found: {file_path}")

        if sys.platform == "win32":
            os.startfile(str(p))
            return ToolResult(success=True, action_taken="open_file", output={"path": str(p), "name": p.name})
        else:
            subprocess.run(["xdg-open", str(p)], check=False)
            return ToolResult(success=True, action_taken="open_file", output={"path": str(p)})
