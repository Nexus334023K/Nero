import ctypes
from typing import Any, Dict, Optional, Tuple

from app.core.logging_config import get_logger
from app.tools.base import BaseTool, PermissionLevel, ToolResult

logger = get_logger(__name__)

# Virtual key constants for Windows multimedia keys
VK_VOLUME_MUTE = 0xAD
VK_VOLUME_DOWN = 0xAE
VK_VOLUME_UP = 0xAF
KEYEVENTF_KEYUP = 0x0002


class VolumeControlTool(BaseTool):
    """Tool for reading and controlling Windows master audio volume and mute state."""

    name = "volume_control"
    description = (
        "Control master audio volume: get current volume level, set volume percentage (0-100), "
        "mute, unmute, or toggle mute."
    )
    permission_level = PermissionLevel.AUTO
    parameters_schema = {
        "type": "object",
        "properties": {
            "action": {
                "type": "string",
                "enum": ["get_volume", "set_volume", "mute", "unmute", "toggle_mute", "volume_up", "volume_down"],
                "description": "Volume action to perform.",
            },
            "level": {
                "type": "integer",
                "minimum": 0,
                "maximum": 100,
                "description": "Target volume level (0 to 100) when action is 'set_volume'.",
            },
        },
        "required": ["action"],
    }

    def _get_audio_endpoint(self):
        """Try initializing pycaw audio endpoint for precise control."""
        try:
            from comtypes import CLSCTX_ALL
            from pycaw.pycaw import AudioUtilities, IAudioEndpointVolume

            devices = AudioUtilities.GetSpeakers()
            interface = devices.Activate(IAudioEndpointVolume._iid_, CLSCTX_ALL, None)
            volume = ctypes.cast(interface, ctypes.POINTER(IAudioEndpointVolume))
            return volume
        except Exception as e:
            logger.debug("pycaw endpoint unavailable: %s", e)
            return None

    def validate_params(self, params: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        action = params.get("action")
        if not action:
            return False, "'action' parameter is required."

        if action == "set_volume":
            level = params.get("level")
            if level is None or not (0 <= int(level) <= 100):
                return False, "'level' must be an integer between 0 and 100 for 'set_volume'."

        return True, None

    async def execute(self, params: Dict[str, Any]) -> ToolResult:
        action = params["action"]
        endpoint = self._get_audio_endpoint()

        try:
            if action == "get_volume":
                if endpoint:
                    current = endpoint.GetMasterVolumeLevelScalar()
                    is_muted = bool(endpoint.GetMute())
                    level_pct = round(current * 100)
                    return ToolResult(
                        success=True,
                        action_taken="get_volume",
                        output={"level": level_pct, "is_muted": is_muted},
                        metadata={"summary": f"Volume: {level_pct}%{' (Muted)' if is_muted else ''}"},
                    )
                else:
                    return ToolResult(
                        success=True,
                        action_taken="get_volume",
                        output={"level": 50, "is_muted": False, "note": "pycaw uninitialized; estimated value"},
                    )

            elif action == "set_volume":
                target_pct = int(params["level"])
                if endpoint:
                    endpoint.SetMasterVolumeLevelScalar(target_pct / 100.0, None)
                    if target_pct > 0 and endpoint.GetMute():
                        endpoint.SetMute(0, None)
                    return ToolResult(
                        success=True,
                        action_taken=f"Set master volume to {target_pct}%",
                        output={"level": target_pct, "is_muted": False},
                    )
                else:
                    return ToolResult(
                        success=False,
                        action_taken="set_volume",
                        error="Precise volume adjustment requires pycaw audio interface.",
                    )

            elif action == "mute":
                if endpoint:
                    endpoint.SetMute(1, None)
                else:
                    self._send_key(VK_VOLUME_MUTE)
                return ToolResult(
                    success=True,
                    action_taken="Muted system audio",
                    output={"is_muted": True},
                )

            elif action == "unmute":
                if endpoint:
                    endpoint.SetMute(0, None)
                else:
                    self._send_key(VK_VOLUME_MUTE)
                return ToolResult(
                    success=True,
                    action_taken="Unmuted system audio",
                    output={"is_muted": False},
                )

            elif action == "toggle_mute":
                if endpoint:
                    muted = bool(endpoint.GetMute())
                    endpoint.SetMute(0 if muted else 1, None)
                    new_state = not muted
                else:
                    self._send_key(VK_VOLUME_MUTE)
                    new_state = None
                return ToolResult(
                    success=True,
                    action_taken="Toggled audio mute",
                    output={"is_muted": new_state},
                )

            elif action == "volume_up":
                if endpoint:
                    curr = endpoint.GetMasterVolumeLevelScalar()
                    new_lvl = min(1.0, curr + 0.05)
                    endpoint.SetMasterVolumeLevelScalar(new_lvl, None)
                    return ToolResult(
                        success=True,
                        action_taken=f"Increased volume to {round(new_lvl * 100)}%",
                        output={"level": round(new_lvl * 100)},
                    )
                else:
                    self._send_key(VK_VOLUME_UP)
                    return ToolResult(success=True, action_taken="Sent volume up key")

            elif action == "volume_down":
                if endpoint:
                    curr = endpoint.GetMasterVolumeLevelScalar()
                    new_lvl = max(0.0, curr - 0.05)
                    endpoint.SetMasterVolumeLevelScalar(new_lvl, None)
                    return ToolResult(
                        success=True,
                        action_taken=f"Decreased volume to {round(new_lvl * 100)}%",
                        output={"level": round(new_lvl * 100)},
                    )
                else:
                    self._send_key(VK_VOLUME_DOWN)
                    return ToolResult(success=True, action_taken="Sent volume down key")

            return ToolResult(success=False, action_taken=action, error=f"Unknown action: {action}")

        except Exception as e:
            logger.error("VolumeControlTool action '%s' failed: %s", action, e)
            return ToolResult(success=False, action_taken=action, error=str(e))

    def _send_key(self, vk_code: int) -> None:
        """Send virtual key down and up event via ctypes."""
        try:
            user32 = ctypes.windll.user32
            user32.keybd_event(vk_code, 0, 0, 0)
            user32.keybd_event(vk_code, 0, KEYEVENTF_KEYUP, 0)
        except Exception as e:
            logger.warning("Failed to dispatch keybd_event: %s", e)
