import re
from typing import Any, Dict, Optional, Tuple

from app.core.logging_config import get_logger

logger = get_logger(__name__)


class ToolIntentDetector:
    """Detects whether a natural language user query corresponds to a desktop tool action."""

    @staticmethod
    def detect(message: str) -> Optional[Tuple[str, Dict[str, Any]]]:
        text = message.strip().lower()

        # 1. System Telemetry
        system_patterns = [
            r"\b(cpu|ram|memory|battery|disk|specs|uptime|system status|system usage|hardware status|system specs|telemetry)\b",
            r"how much (ram|memory|cpu|battery|disk)",
            r"what('s| is) my (cpu|ram|memory|battery|system|specs)",
            r"check (system|cpu|ram|memory|battery|pc)",
        ]
        if any(re.search(pat, text) for pat in system_patterns) and not any(
            k in text for k in ["code", "script", "program", "function", "write"]
        ):
            return "system_monitor", {"metrics": ["all"]}

        # 2. Volume Control
        vol_set_match = re.search(r"\b(?:set|turn|change)\s+(?:the\s+)?volume\s+(?:to\s+)?(\d{1,3})%?\b", text)
        if vol_set_match:
            pct = min(100, max(0, int(vol_set_match.group(1))))
            return "volume_control", {"action": "set_volume", "level": pct}

        if re.search(r"\b(mute\s+(?:the\s+)?(?:audio|sound|volume)|mute\s+all)\b", text) or text == "mute":
            return "volume_control", {"action": "mute"}

        if re.search(r"\b(unmute\s+(?:the\s+)?(?:audio|sound|volume)|unmute)\b", text):
            return "volume_control", {"action": "unmute"}

        if re.search(r"\b(volume\s+up|increase\s+volume|turn\s+(?:the\s+)?volume\s+up|louder)\b", text):
            return "volume_control", {"action": "volume_up"}

        if re.search(r"\b(volume\s+down|decrease\s+volume|turn\s+(?:the\s+)?volume\s+down|quieter|lower\s+volume)\b", text):
            return "volume_control", {"action": "volume_down"}

        if re.search(r"\bwhat('s| is)\s+(?:the\s+)?volume\b", text):
            return "volume_control", {"action": "get_volume"}

        # 3. Application Launcher
        app_match = re.search(
            r"\b(?:open|launch|start|run)\s+(?:the\s+)?(notepad|calculator|calc|explorer|file\s+explorer|files|terminal|powershell|vscode|code|paint|task\s+manager|taskmgr|browser)\b",
            text,
        )
        if app_match:
            app_raw = app_match.group(1).replace(" ", "_")
            alias_map = {
                "file_explorer": "explorer",
                "files": "explorer",
                "task_manager": "taskmgr",
            }
            app_name = alias_map.get(app_raw, app_raw)
            return "launch_application", {"app_name": app_name}

        # 4. Safe Filesystem Operations
        list_match = re.search(r"\b(?:list|show|view)\s+(?:all\s+)?(?:files|folders|directory|contents)\s+(?:in|of)\s+([a-zA-Z]:[\\/][^\s]+|[\.\w\-\\/]+)", text)
        if list_match:
            target_path = list_match.group(1).strip("\"'")
            return "file_manager", {"action": "list_dir", "path": target_path}

        read_match = re.search(r"\b(?:read|open|show|inspect)\s+(?:the\s+)?file\s+([a-zA-Z]:[\\/][^\s]+|[\w\-\\/]+\.[\w]+)", text)
        if read_match:
            target_path = read_match.group(1).strip("\"'")
            return "file_manager", {"action": "read_file", "path": target_path}

        del_match = re.search(r"\b(?:delete|remove)\s+(?:the\s+)?file\s+([a-zA-Z]:[\\/][^\s]+|[\w\-\\/]+\.[\w]+)", text)
        if del_match:
            target_path = del_match.group(1).strip("\"'")
            return "file_manager", {"action": "delete_file", "path": target_path}

        return None
