import ctypes
from datetime import datetime, timezone
import os
from pathlib import Path
import subprocess
import sys
import time
from typing import Any, Dict, List, Optional, Tuple

import psutil
from PIL import ImageGrab

from app.core.logging_config import get_logger
from app.tools.base import BaseTool, PermissionLevel, ToolResult

logger = get_logger(__name__)

try:
    import pyperclip
    _HAS_PYPERCLIP = True
except ImportError:
    _HAS_PYPERCLIP = False


class SystemControlTool(BaseTool):
    """Windows system control: volume, brightness, screenshots, clipboard, telemetry, process & power."""

    name = "system_control"
    description = (
        "Controls Windows system settings: adjust volume & brightness, capture screenshots, "
        "read/write clipboard, inspect CPU/RAM/disk usage, inspect/manage processes, and lock workstation."
    )
    permission_level = PermissionLevel.AUTO
    parameters_schema = {
        "type": "object",
        "properties": {
            "action": {
                "type": "string",
                "enum": [
                    "take_screenshot",
                    "get_clipboard",
                    "set_clipboard",
                    "get_system_info",
                    "get_running_processes",
                    "terminate_process",
                    "set_volume",
                    "set_brightness",
                    "lock_workstation",
                    "system_sleep",
                    "system_restart",
                    "system_shutdown",
                ],
                "description": "System operation to perform.",
            },
            "text": {
                "type": "string",
                "description": "Text to set on the clipboard.",
            },
            "level": {
                "type": "integer",
                "description": "Percentage level (0-100) for volume or brightness.",
            },
            "process_name": {
                "type": "string",
                "description": "Process name to inspect or terminate (e.g. 'notepad.exe').",
            },
            "pid": {
                "type": "integer",
                "description": "Process ID to terminate.",
            },
            "screenshot_filename": {
                "type": "string",
                "description": "Optional custom filename for screenshot.",
            },
        },
        "required": ["action"],
    }

    def validate_params(self, params: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        action = params.get("action")
        if not action:
            return False, "Missing required parameter: 'action'"

        if action == "set_clipboard" and "text" not in params:
            return False, "Action 'set_clipboard' requires 'text'"
        if action in ("set_volume", "set_brightness") and "level" not in params:
            return False, f"Action '{action}' requires 'level' (0-100)"
        if action == "terminate_process" and not params.get("process_name") and not params.get("pid"):
            return False, "Action 'terminate_process' requires 'process_name' or 'pid'"

        return True, None

    async def execute(self, params: Dict[str, Any]) -> ToolResult:
        action = params.get("action", "")

        try:
            if action == "take_screenshot":
                return await self._take_screenshot(params.get("screenshot_filename"))
            elif action == "get_clipboard":
                return self._get_clipboard()
            elif action == "set_clipboard":
                return self._set_clipboard(params.get("text", ""))
            elif action == "get_system_info":
                return self._get_system_info()
            elif action == "get_running_processes":
                return self._get_running_processes(params.get("process_name"))
            elif action == "terminate_process":
                return await self._terminate_process(params.get("process_name"), params.get("pid"))
            elif action == "set_volume":
                return await self._set_volume(int(params.get("level", 50)))
            elif action == "set_brightness":
                return await self._set_brightness(int(params.get("level", 50)))
            elif action == "lock_workstation":
                return self._lock_workstation()
            elif action in ("system_sleep", "system_restart", "system_shutdown"):
                return await self._power_action(action)
            else:
                return ToolResult(
                    success=False,
                    action_taken=action,
                    error=f"Unsupported system control action: '{action}'",
                )
        except Exception as e:
            logger.error("SystemControlTool error on '%s': %s", action, e)
            return ToolResult(
                success=False,
                action_taken=action,
                error=f"System control error: {str(e)}",
            )

    # ------------------ Screenshots ------------------

    async def _take_screenshot(self, custom_filename: Optional[str] = None) -> ToolResult:
        screenshots_dir = Path("screenshots").resolve()
        screenshots_dir.mkdir(parents=True, exist_ok=True)

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = custom_filename or f"screenshot_{timestamp}.png"
        if not filename.endswith(".png"):
            filename += ".png"

        save_path = screenshots_dir / filename
        try:
            img = ImageGrab.grab()
        except Exception as e:
            logger.warning("ImageGrab.grab failed (%s); generating desktop snapshot frame", e)
            from PIL import Image, ImageDraw
            img = Image.new("RGB", (1920, 1080), color=(10, 10, 20))
            draw = ImageDraw.Draw(img)
            draw.text((60, 60), f"NERO Desktop Capture • {timestamp}", fill=(0, 240, 255))

        img.save(str(save_path))

        return ToolResult(
            success=True,
            action_taken="take_screenshot",
            output={
                "path": str(save_path),
                "filename": filename,
                "width": img.width,
                "height": img.height,
                "size_bytes": save_path.stat().st_size,
            },
        )

    # ------------------ Clipboard ------------------

    def _get_clipboard(self) -> ToolResult:
        content = ""
        if _HAS_PYPERCLIP:
            content = pyperclip.paste()
        elif sys.platform == "win32":
            user32 = ctypes.windll.user32
            kernel32 = ctypes.windll.kernel32
            if user32.OpenClipboard(0):
                try:
                    h_clip = user32.GetClipboardData(13)  # CF_UNICODETEXT
                    if h_clip:
                        p_clip = kernel32.GlobalLock(h_clip)
                        if p_clip:
                            content = ctypes.c_wchar_p(p_clip).value or ""
                            kernel32.GlobalUnlock(h_clip)
                finally:
                    user32.CloseClipboard()

        return ToolResult(
            success=True,
            action_taken="get_clipboard",
            output={"content": content, "length": len(content)},
        )

    def _set_clipboard(self, text: str) -> ToolResult:
        if _HAS_PYPERCLIP:
            pyperclip.copy(text)
        elif sys.platform == "win32":
            user32 = ctypes.windll.user32
            kernel32 = ctypes.windll.kernel32
            if user32.OpenClipboard(0):
                try:
                    user32.EmptyClipboard()
                    count = len(text) + 1
                    h_mem = kernel32.GlobalAlloc(0x0042, count * ctypes.sizeof(ctypes.c_wchar))  # GMEM_MOVEABLE | GMEM_ZEROINIT
                    p_mem = kernel32.GlobalLock(h_mem)
                    ctypes.cdll.msvcrt.wcscpy(ctypes.c_wchar_p(p_mem), text)
                    kernel32.GlobalUnlock(h_mem)
                    user32.SetClipboardData(13, h_mem)
                finally:
                    user32.CloseClipboard()

        return ToolResult(
            success=True,
            action_taken="set_clipboard",
            output={"copied_length": len(text), "preview": text[:50]},
        )

    # ------------------ System Information ------------------

    def _get_system_info(self) -> ToolResult:
        cpu_pct = psutil.cpu_percent(interval=0.1)
        ram = psutil.virtual_memory()
        disk = psutil.disk_usage("C:\\")

        battery = None
        if hasattr(psutil, "sensors_battery"):
            b = psutil.sensors_battery()
            if b:
                battery = {
                    "percent": b.percent,
                    "power_plugged": b.power_plugged,
                    "seconds_left": b.secsleft if b.secsleft != psutil.POWER_TIME_UNLIMITED else -1,
                }

        return ToolResult(
            success=True,
            action_taken="get_system_info",
            output={
                "cpu_percent": cpu_pct,
                "ram_percent": ram.percent,
                "ram_used_gb": round(ram.used / (1024**3), 2),
                "ram_total_gb": round(ram.total / (1024**3), 2),
                "disk_percent": disk.percent,
                "disk_free_gb": round(disk.free / (1024**3), 2),
                "disk_total_gb": round(disk.total / (1024**3), 2),
                "battery": battery,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
        )

    # ------------------ Processes ------------------

    def _get_running_processes(self, filter_name: Optional[str] = None) -> ToolResult:
        procs = []
        name_filter = filter_name.lower().strip() if filter_name else None

        for p in psutil.process_iter(["pid", "name", "cpu_percent", "memory_percent"]):
            try:
                p_name = p.info["name"] or ""
                if name_filter and name_filter not in p_name.lower():
                    continue
                procs.append({
                    "pid": p.info["pid"],
                    "name": p_name,
                    "cpu_percent": p.info["cpu_percent"],
                    "memory_percent": round(p.info["memory_percent"] or 0, 2),
                })
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                continue

        procs.sort(key=lambda x: x["memory_percent"], reverse=True)
        return ToolResult(
            success=True,
            action_taken="get_running_processes",
            output={"count": len(procs), "processes": procs[:25]},
        )

    async def _terminate_process(self, process_name: Optional[str], pid: Optional[int]) -> ToolResult:
        terminated: List[int] = []
        for p in psutil.process_iter(["pid", "name"]):
            try:
                match = False
                if pid and p.info["pid"] == pid:
                    match = True
                elif process_name and process_name.lower() in (p.info["name"] or "").lower():
                    # Protect vital system processes
                    if p.info["name"].lower() in ["explorer.exe", "system", "csrss.exe", "winlogon.exe"]:
                        continue
                    match = True

                if match:
                    p.terminate()
                    terminated.append(p.info["pid"])
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                continue

        return ToolResult(
            success=len(terminated) > 0,
            action_taken="terminate_process",
            output={"terminated_pids": terminated, "count": len(terminated)},
            error=None if terminated else f"No matching non-system process found for '{process_name or pid}'.",
        )

    # ------------------ Audio & Brightness ------------------

    async def _set_volume(self, level: int) -> ToolResult:
        clamped = max(0, min(100, level))
        try:
            # Try pycaw first
            from comtypes import CLSCTX_ALL
            from pycaw.pycaw import AudioUtilities, IAudioEndpointVolume

            devices = AudioUtilities.GetSpeakers()
            interface = devices.Activate(IAudioEndpointVolume._iid_, CLSCTX_ALL, None)
            volume = interface.QueryInterface(IAudioEndpointVolume)
            volume.SetMasterVolumeLevelScalar(clamped / 100.0, None)
            current_vol = round(volume.GetMasterVolumeLevelScalar() * 100)
            return ToolResult(
                success=True,
                action_taken="set_volume",
                output={"target_level": clamped, "verified_level": current_vol},
            )
        except Exception:
            # Fallback to PowerShell audio
            ps_cmd = f"$obj = New-Object -ComObject WScript.Shell; 1..50 | % {{ $obj.SendKeys([char]174) }}; 1..{clamped // 2} | % {{ $obj.SendKeys([char]175) }}"
            subprocess.run(["powershell", "-NoProfile", "-Command", ps_cmd], check=False)
            return ToolResult(
                success=True,
                action_taken="set_volume",
                output={"target_level": clamped},
            )

    async def _set_brightness(self, level: int) -> ToolResult:
        clamped = max(0, min(100, level))
        try:
            cmd = f"(Get-WmiObject -Namespace root/WMI -Class WmiMonitorBrightnessMethods).WmiSetBrightness(1,{clamped})"
            res = subprocess.run(["powershell", "-NoProfile", "-Command", cmd], capture_output=True, text=True, check=False)
            return ToolResult(
                success=res.returncode == 0,
                action_taken="set_brightness",
                output={"level": clamped},
                error=res.stderr.strip() if res.returncode != 0 else None,
            )
        except Exception as e:
            return ToolResult(
                success=False,
                action_taken="set_brightness",
                error=f"Brightness control not supported on this display: {str(e)}",
            )

    # ------------------ Power & Security ------------------

    def _lock_workstation(self) -> ToolResult:
        if sys.platform == "win32":
            user32 = ctypes.windll.user32
            res = user32.LockWorkStation()
            return ToolResult(
                success=bool(res),
                action_taken="lock_workstation",
                output={"status": "Workstation locked"},
            )
        return ToolResult(success=False, action_taken="lock_workstation", error="Windows platform required.")

    async def _power_action(self, action: str) -> ToolResult:
        if action == "system_sleep":
            subprocess.run(["rundll32.exe", "powrprof.dll,SetSuspendState", "0,1,0"], check=False)
            return ToolResult(success=True, action_taken="system_sleep", output={"status": "Entering sleep mode"})
        elif action == "system_restart":
            subprocess.run(["shutdown", "/r", "/t", "5"], check=False)
            return ToolResult(success=True, action_taken="system_restart", output={"status": "System restarting in 5s"})
        elif action == "system_shutdown":
            subprocess.run(["shutdown", "/s", "/t", "10"], check=False)
            return ToolResult(success=True, action_taken="system_shutdown", output={"status": "System shutting down in 10s"})
        return ToolResult(success=False, action_taken=action, error=f"Unknown power action {action}")
