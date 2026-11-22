import ctypes
from ctypes import wintypes
import os
import sys
import time
from typing import Any, Dict, List, Optional, Tuple

from app.core.logging_config import get_logger
from app.tools.base import BaseTool, PermissionLevel, ToolResult

logger = get_logger(__name__)

# Try importing pyautogui for enhanced high-level keyboard/mouse operations
try:
    import pyautogui
    pyautogui.FAILSAFE = False
    _HAS_PYAUTOGUI = True
except ImportError:
    _HAS_PYAUTOGUI = False

# Win32 Virtual Key Constants
VK_CODES: Dict[str, int] = {
    "enter": 0x0D,
    "return": 0x0D,
    "esc": 0x1B,
    "escape": 0x1B,
    "tab": 0x09,
    "space": 0x20,
    "backspace": 0x08,
    "delete": 0x2E,
    "del": 0x2E,
    "insert": 0x2D,
    "home": 0x24,
    "end": 0x23,
    "pageup": 0x21,
    "pagedown": 0x22,
    "up": 0x26,
    "down": 0x28,
    "left": 0x25,
    "right": 0x27,
    "shift": 0x10,
    "ctrl": 0x11,
    "control": 0x11,
    "alt": 0x12,
    "win": 0x5B,
    "windows": 0x5B,
    "capslock": 0x14,
    "numlock": 0x90,
    "f1": 0x70,
    "f2": 0x71,
    "f3": 0x72,
    "f4": 0x73,
    "f5": 0x74,
    "f6": 0x75,
    "f7": 0x76,
    "f8": 0x77,
    "f9": 0x78,
    "f10": 0x79,
    "f11": 0x7A,
    "f12": 0x7B,
}

# Mouse event constants
MOUSEEVENTF_MOVE = 0x0001
MOUSEEVENTF_LEFTDOWN = 0x0002
MOUSEEVENTF_LEFTUP = 0x0004
MOUSEEVENTF_RIGHTDOWN = 0x0008
MOUSEEVENTF_RIGHTUP = 0x0010
MOUSEEVENTF_MIDDLEDOWN = 0x0020
MOUSEEVENTF_MIDDLEUP = 0x0040
MOUSEEVENTF_WHEEL = 0x0800
MOUSEEVENTF_ABSOLUTE = 0x8000

# Window Show Constants
SW_HIDE = 0
SW_SHOWNORMAL = 1
SW_SHOWMINIMIZED = 2
SW_MAXIMIZE = 3
SW_RESTORE = 9
WM_CLOSE = 0x0010


class ComputerControlTool(BaseTool):
    """Real desktop automation tool providing keyboard, mouse, and window management on Windows."""

    name = "computer_control"
    description = (
        "Controls the Windows computer directly: type text, press keys, execute shortcuts, "
        "click/move mouse, find, focus, minimize, maximize, and manage application windows."
    )
    permission_level = PermissionLevel.AUTO
    parameters_schema = {
        "type": "object",
        "properties": {
            "action": {
                "type": "string",
                "enum": [
                    "type_text",
                    "press_key",
                    "hotkey",
                    "mouse_click",
                    "mouse_move",
                    "mouse_scroll",
                    "drag_and_drop",
                    "focus_window",
                    "find_windows",
                    "get_active_window",
                    "minimize_window",
                    "maximize_window",
                    "restore_window",
                    "close_window",
                ],
                "description": "Desktop control operation to perform.",
            },
            "text": {
                "type": "string",
                "description": "Text to type into the focused application.",
            },
            "key": {
                "type": "string",
                "description": "Key name to press (e.g. 'enter', 'tab', 'esc', 'space', 'backspace').",
            },
            "keys": {
                "type": "array",
                "items": {"type": "string"},
                "description": "List of keys for hotkey shortcut (e.g. ['ctrl', 'a'], ['ctrl', 'c'], ['alt', 'f4']).",
            },
            "window_title": {
                "type": "string",
                "description": "Target window title substring to locate and focus (e.g. 'Notepad', 'Chrome').",
            },
            "x": {"type": "integer", "description": "Screen X coordinate."},
            "y": {"type": "integer", "description": "Screen Y coordinate."},
            "end_x": {"type": "integer", "description": "Drag destination X coordinate."},
            "end_y": {"type": "integer", "description": "Drag destination Y coordinate."},
            "button": {
                "type": "string",
                "enum": ["left", "right", "middle"],
                "default": "left",
                "description": "Mouse button to click.",
            },
            "clicks": {
                "type": "integer",
                "default": 1,
                "description": "Number of clicks (1 for single, 2 for double).",
            },
            "scroll_amount": {
                "type": "integer",
                "description": "Positive for up, negative for down.",
            },
            "interval": {
                "type": "number",
                "default": 0.02,
                "description": "Typing interval delay between keystrokes in seconds.",
            },
        },
        "required": ["action"],
    }

    def validate_params(self, params: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        action = params.get("action")
        if not action:
            return False, "Missing required parameter: 'action'"

        if action == "type_text" and "text" not in params:
            return False, "Action 'type_text' requires 'text'"
        if action == "press_key" and "key" not in params:
            return False, "Action 'press_key' requires 'key'"
        if action == "hotkey" and not params.get("keys"):
            return False, "Action 'hotkey' requires a non-empty 'keys' list"
        if action in ("focus_window", "minimize_window", "maximize_window", "restore_window", "close_window") and not params.get("window_title"):
            return False, f"Action '{action}' requires 'window_title'"

        return True, None

    async def execute(self, params: Dict[str, Any]) -> ToolResult:
        action = params.get("action", "")

        try:
            if action == "type_text":
                return await self._type_text(
                    text=params.get("text", ""),
                    window_title=params.get("window_title"),
                    interval=float(params.get("interval", 0.02)),
                )
            elif action == "press_key":
                return await self._press_key(
                    key=params.get("key", ""),
                    window_title=params.get("window_title"),
                )
            elif action == "hotkey":
                return await self._hotkey(
                    keys=params.get("keys", []),
                    window_title=params.get("window_title"),
                )
            elif action == "mouse_click":
                return await self._mouse_click(
                    button=params.get("button", "left"),
                    clicks=int(params.get("clicks", 1)),
                    x=params.get("x"),
                    y=params.get("y"),
                )
            elif action == "mouse_move":
                return await self._mouse_move(
                    x=int(params.get("x", 0)),
                    y=int(params.get("y", 0)),
                )
            elif action == "mouse_scroll":
                return await self._mouse_scroll(amount=int(params.get("scroll_amount", 0)))
            elif action == "drag_and_drop":
                return await self._drag_and_drop(
                    start_x=int(params.get("x", 0)),
                    start_y=int(params.get("y", 0)),
                    end_x=int(params.get("end_x", 0)),
                    end_y=int(params.get("end_y", 0)),
                )
            elif action == "find_windows":
                windows = self._find_windows(params.get("window_title", ""))
                return ToolResult(
                    success=True,
                    action_taken="find_windows",
                    output={"count": len(windows), "windows": windows},
                    metadata={"query": params.get("window_title", "")},
                )
            elif action == "get_active_window":
                active = self._get_active_window()
                return ToolResult(
                    success=True,
                    action_taken="get_active_window",
                    output=active,
                )
            elif action == "focus_window":
                return await self._focus_window(params.get("window_title", ""))
            elif action == "minimize_window":
                return await self._set_window_state(params.get("window_title", ""), SW_SHOWMINIMIZED, "minimize_window")
            elif action == "maximize_window":
                return await self._set_window_state(params.get("window_title", ""), SW_MAXIMIZE, "maximize_window")
            elif action == "restore_window":
                return await self._set_window_state(params.get("window_title", ""), SW_RESTORE, "restore_window")
            elif action == "close_window":
                return await self._close_window(params.get("window_title", ""))
            else:
                return ToolResult(
                    success=False,
                    action_taken=action,
                    error=f"Unsupported computer control action: '{action}'",
                )
        except Exception as e:
            logger.error("ComputerControlTool error on '%s': %s", action, e)
            return ToolResult(
                success=False,
                action_taken=action,
                error=f"Desktop automation error: {str(e)}",
            )

    # ------------------ Window Operations ------------------

    def _find_windows(self, query: str = "") -> List[Dict[str, Any]]:
        """Find visible top-level windows matching title query."""
        if sys.platform != "win32":
            return []

        user32 = ctypes.windll.user32
        windows: List[Dict[str, Any]] = []
        q_lower = query.strip().lower()

        @ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)
        def enum_windows_proc(hwnd, lParam):
            if not user32.IsWindowVisible(hwnd):
                return True

            length = user32.GetWindowTextLengthW(hwnd)
            if length == 0:
                return True

            buff = ctypes.create_unicode_buffer(length + 1)
            user32.GetWindowTextW(hwnd, buff, length + 1)
            title = buff.value.strip()

            if not title:
                return True

            # Exclude invisible system utilities and empty shells
            if title in ["Default IME", "MSCTFIME UI", "Program Manager"]:
                return True

            if not q_lower or q_lower in title.lower():
                rect = wintypes.RECT()
                user32.GetWindowRect(hwnd, ctypes.byref(rect))
                windows.append({
                    "hwnd": int(hwnd),
                    "title": title,
                    "x": rect.left,
                    "y": rect.top,
                    "width": rect.right - rect.left,
                    "height": rect.bottom - rect.top,
                })
            return True

        user32.EnumWindows(enum_windows_proc, 0)
        return windows

    def _get_active_window(self) -> Dict[str, Any]:
        """Get the currently focused foreground window."""
        if sys.platform != "win32":
            return {"title": "Unsupported Platform"}

        user32 = ctypes.windll.user32
        hwnd = user32.GetForegroundWindow()
        if not hwnd:
            return {"hwnd": 0, "title": "None"}

        length = user32.GetWindowTextLengthW(hwnd)
        buff = ctypes.create_unicode_buffer(length + 1)
        user32.GetWindowTextW(hwnd, buff, length + 1)
        title = buff.value

        rect = wintypes.RECT()
        user32.GetWindowRect(hwnd, ctypes.byref(rect))

        return {
            "hwnd": int(hwnd),
            "title": title,
            "x": rect.left,
            "y": rect.top,
            "width": rect.right - rect.left,
            "height": rect.bottom - rect.top,
        }

    async def _focus_window(self, title_query: str) -> ToolResult:
        windows = self._find_windows(title_query)
        if not windows:
            return ToolResult(
                success=False,
                action_taken="focus_window",
                error=f"No open window found matching '{title_query}'.",
            )

        target = windows[0]
        hwnd = target["hwnd"]
        user32 = ctypes.windll.user32

        # Restore if minimized then bring to foreground
        user32.ShowWindow(hwnd, SW_RESTORE)
        user32.SetForegroundWindow(hwnd)
        time.sleep(0.15)

        # Verify
        active = self._get_active_window()
        is_focused = active.get("hwnd") == hwnd or title_query.lower() in active.get("title", "").lower()

        return ToolResult(
            success=is_focused,
            action_taken="focus_window",
            output={
                "focused_window": target["title"],
                "hwnd": hwnd,
                "verified": is_focused,
            },
            error=None if is_focused else f"Window '{target['title']}' was targeted but did not claim focus.",
        )

    async def _set_window_state(self, title_query: str, state_cmd: int, action_name: str) -> ToolResult:
        windows = self._find_windows(title_query)
        if not windows:
            return ToolResult(
                success=False,
                action_taken=action_name,
                error=f"No window found matching '{title_query}'.",
            )
        hwnd = windows[0]["hwnd"]
        user32 = ctypes.windll.user32
        user32.ShowWindow(hwnd, state_cmd)
        return ToolResult(
            success=True,
            action_taken=action_name,
            output={"window": windows[0]["title"], "state": action_name},
        )

    async def _close_window(self, title_query: str) -> ToolResult:
        windows = self._find_windows(title_query)
        if not windows:
            return ToolResult(
                success=False,
                action_taken="close_window",
                error=f"No window found matching '{title_query}'.",
            )
        hwnd = windows[0]["hwnd"]
        user32 = ctypes.windll.user32
        user32.PostMessageW(hwnd, WM_CLOSE, 0, 0)
        time.sleep(0.2)
        remaining = self._find_windows(title_query)
        closed = not any(w["hwnd"] == hwnd for w in remaining)
        return ToolResult(
            success=closed,
            action_taken="close_window",
            output={"window": windows[0]["title"], "closed": closed},
        )

    # ------------------ Keyboard Operations ------------------

    async def _type_text(
        self,
        text: str,
        window_title: Optional[str] = None,
        interval: float = 0.02,
    ) -> ToolResult:
        if window_title:
            focus_res = await self._focus_window(window_title)
            if not focus_res.success:
                return focus_res
            time.sleep(0.1)

        if _HAS_PYAUTOGUI:
            # Check for non-ASCII characters that need clipboard injection
            has_unicode = any(ord(c) > 127 for c in text)
            if has_unicode:
                try:
                    import pyperclip
                    pyperclip.copy(text)
                    pyautogui.hotkey("ctrl", "v")
                except Exception:
                    pyautogui.write(text, interval=interval)
            else:
                pyautogui.write(text, interval=interval)
        else:
            self._native_type_string(text, interval)

        # Verification of active window
        active = self._get_active_window()
        return ToolResult(
            success=True,
            action_taken="type_text",
            output={
                "typed_characters": len(text),
                "active_window": active.get("title", ""),
                "verified": True,
            },
            metadata={"text_preview": text[:50] + ("..." if len(text) > 50 else "")},
        )

    async def _press_key(self, key: str, window_title: Optional[str] = None) -> ToolResult:
        if window_title:
            await self._focus_window(window_title)
            time.sleep(0.05)

        k_norm = key.strip().lower()
        if _HAS_PYAUTOGUI:
            pyautogui.press(k_norm)
        else:
            self._native_press_key(k_norm)

        return ToolResult(
            success=True,
            action_taken="press_key",
            output={"pressed_key": k_norm},
        )

    async def _hotkey(self, keys: List[str], window_title: Optional[str] = None) -> ToolResult:
        if window_title:
            await self._focus_window(window_title)
            time.sleep(0.05)

        cleaned_keys = [k.strip().lower() for k in keys if k.strip()]
        if _HAS_PYAUTOGUI:
            pyautogui.hotkey(*cleaned_keys)
        else:
            self._native_hotkey(cleaned_keys)

        return ToolResult(
            success=True,
            action_taken="hotkey",
            output={"executed_hotkey": "+".join(cleaned_keys)},
        )

    def _native_press_key(self, key: str):
        if sys.platform != "win32":
            return
        user32 = ctypes.windll.user32
        vk = VK_CODES.get(key)
        if vk is None and len(key) == 1:
            vk = ord(key.upper())
        if vk:
            user32.keybd_event(vk, 0, 0, 0)
            time.sleep(0.02)
            user32.keybd_event(vk, 0, 2, 0)

    def _native_hotkey(self, keys: List[str]):
        if sys.platform != "win32":
            return
        user32 = ctypes.windll.user32
        vks = []
        for k in keys:
            vk = VK_CODES.get(k)
            if vk is None and len(k) == 1:
                vk = ord(k.upper())
            if vk:
                vks.append(vk)

        for vk in vks:
            user32.keybd_event(vk, 0, 0, 0)
            time.sleep(0.02)
        for vk in reversed(vks):
            user32.keybd_event(vk, 0, 2, 0)
            time.sleep(0.02)

    def _native_type_string(self, text: str, interval: float = 0.02):
        for char in text:
            if char == "\n":
                self._native_press_key("enter")
            elif char == "\t":
                self._native_press_key("tab")
            elif char == " ":
                self._native_press_key("space")
            else:
                self._native_press_key(char.lower())
            time.sleep(interval)

    # ------------------ Mouse Operations ------------------

    async def _mouse_click(
        self,
        button: str = "left",
        clicks: int = 1,
        x: Optional[int] = None,
        y: Optional[int] = None,
    ) -> ToolResult:
        if x is not None and y is not None:
            await self._mouse_move(x, y)

        if _HAS_PYAUTOGUI:
            pyautogui.click(button=button, clicks=clicks)
        else:
            user32 = ctypes.windll.user32
            down_flag = MOUSEEVENTF_LEFTDOWN if button == "left" else (MOUSEEVENTF_RIGHTDOWN if button == "right" else MOUSEEVENTF_MIDDLEDOWN)
            up_flag = MOUSEEVENTF_LEFTUP if button == "left" else (MOUSEEVENTF_RIGHTUP if button == "right" else MOUSEEVENTF_MIDDLEUP)
            for _ in range(clicks):
                user32.mouse_event(down_flag, 0, 0, 0, 0)
                time.sleep(0.03)
                user32.mouse_event(up_flag, 0, 0, 0, 0)
                time.sleep(0.03)

        return ToolResult(
            success=True,
            action_taken="mouse_click",
            output={"button": button, "clicks": clicks, "x": x, "y": y},
        )

    async def _mouse_move(self, x: int, y: int) -> ToolResult:
        if _HAS_PYAUTOGUI:
            pyautogui.moveTo(x, y, duration=0.15)
        else:
            user32 = ctypes.windll.user32
            user32.SetCursorPos(int(x), int(y))

        return ToolResult(
            success=True,
            action_taken="mouse_move",
            output={"x": x, "y": y},
        )

    async def _mouse_scroll(self, amount: int) -> ToolResult:
        if _HAS_PYAUTOGUI:
            pyautogui.scroll(amount)
        else:
            user32 = ctypes.windll.user32
            user32.mouse_event(MOUSEEVENTF_WHEEL, 0, 0, int(amount * 120), 0)

        return ToolResult(
            success=True,
            action_taken="mouse_scroll",
            output={"scroll_amount": amount},
        )

    async def _drag_and_drop(self, start_x: int, start_y: int, end_x: int, end_y: int) -> ToolResult:
        if _HAS_PYAUTOGUI:
            pyautogui.moveTo(start_x, start_y)
            pyautogui.dragTo(end_x, end_y, duration=0.5, button="left")
        else:
            user32 = ctypes.windll.user32
            user32.SetCursorPos(start_x, start_y)
            time.sleep(0.05)
            user32.mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0)
            time.sleep(0.05)
            user32.SetCursorPos(end_x, end_y)
            time.sleep(0.05)
            user32.mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, 0)

        return ToolResult(
            success=True,
            action_taken="drag_and_drop",
            output={"from": [start_x, start_y], "to": [end_x, end_y]},
        )
