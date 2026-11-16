import re
from typing import Any, Dict, Optional, Tuple

from app.core.logging_config import get_logger

logger = get_logger(__name__)


class ToolIntentDetector:
    """Detects whether a natural language user query corresponds to a desktop,

    developer, web research, or productivity tool action.
    """

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

        # 5. Web Research: Search & URL Reader
        url_match = re.search(r"\b(?:read|summarize|fetch|inspect)\s+(?:url|website|webpage|page|site)?\s*(https?://[^\s]+)", text)
        if url_match:
            target_url = url_match.group(1).strip("\"'")
            return "web_reader", {"url": target_url}

        search_match = re.search(
            r"\b(?:search\s+(?:the\s+)?(?:web|internet|online)\s+(?:for\s+)?|look\s+up\s+(?:online\s+)?|google\s+)(.+)",
            text,
        )
        if search_match:
            query = search_match.group(1).strip()
            return "web_search", {"query": query}

        # 6. Developer Companion: Git & Project Analysis
        if re.search(r"\b(git\s+status|check\s+git|git\s+repo\s+status|git\s+changes)\b", text):
            return "git_analyzer", {"action": "status", "repo_path": "D:\\Nero"}

        if re.search(r"\b(git\s+log|recent\s+commits|git\s+history)\b", text):
            return "git_analyzer", {"action": "log", "repo_path": "D:\\Nero"}

        if re.search(r"\b(git\s+branch|current\s+branch|what\s+branch)\b", text):
            return "git_analyzer", {"action": "status", "repo_path": "D:\\Nero"}

        if re.search(r"\b(git\s+diff|uncommitted\s+diff)\b", text):
            return "git_analyzer", {"action": "diff_stat", "repo_path": "D:\\Nero"}

        if re.search(r"\b(analyze\s+(?:this\s+)?project|project\s+structure|scan\s+workspace|what\s+tech\s+stack)\b", text):
            return "project_structure", {"path": "D:\\Nero"}

        # 7. Productivity & Task Manager
        if re.search(r"\b(daily\s+briefing|morning\s+briefing|what('s| is)\s+my\s+day\s+look\s+like|productivity\s+overview)\b", text):
            return "task_manager", {"action": "daily_briefing"}

        task_add_match = re.search(r"\b(?:add|create)\s+(?:a\s+)?task\s*[:\-]?\s*(.+)", text)
        if task_add_match:
            title = task_add_match.group(1).strip()
            return "task_manager", {"action": "create_task", "title": title, "priority": "medium"}

        remind_match = re.search(r"\bremind\s+me\s+to\s+(.+)", text)
        if remind_match:
            title = remind_match.group(1).strip()
            return "task_manager", {"action": "create_task", "title": title, "priority": "high"}

        if re.search(r"\b(show|list|what\s+are)\s+(?:my\s+)?tasks\b", text):
            return "task_manager", {"action": "list_tasks", "status_filter": "pending"}

        return None
