import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from app.core.logging_config import get_logger
from app.tools.base import BaseTool, PermissionLevel, ToolResult

logger = get_logger(__name__)

# Sensitive system path fragments that must never be accessed or modified
SENSITIVE_PATH_PATTERNS = [
    r"windows\system32",
    r"windows\syswow64",
    r"\.ssh",
    r"\.gnupg",
    r"\credentials",
    r"\system volume information",
    r"windows\regshot",
]

MAX_READ_BYTES = 512 * 1024  # 512 KB limit for safe reads


class FileManagerTool(BaseTool):
    """Tool for safe filesystem interactions: listing directories, reading files,

    creating folders/files, and guarded deletion.
    """

    name = "file_manager"
    description = (
        "Perform safe file and folder operations: list directories, read text files, "
        "create directories, write files, and safely delete files (with explicit confirmation)."
    )
    permission_level = PermissionLevel.PERMISSION_REQUIRED
    parameters_schema = {
        "type": "object",
        "properties": {
            "action": {
                "type": "string",
                "enum": ["list_dir", "read_file", "create_file", "create_folder", "delete_file"],
                "description": "Filesystem operation to perform.",
            },
            "path": {
                "type": "string",
                "description": "Target file or directory path.",
            },
            "content": {
                "type": "string",
                "description": "Content to write when action is 'create_file'.",
            },
            "max_items": {
                "type": "integer",
                "default": 100,
                "description": "Maximum number of directory entries to list.",
            },
        },
        "required": ["action", "path"],
    }

    def _is_path_safe(self, target_path: str) -> Tuple[bool, Optional[str]]:
        """Verify that path is canonical, not in blocked system areas."""
        try:
            resolved = Path(target_path).resolve()
            resolved_str = str(resolved).lower()

            for pattern in SENSITIVE_PATH_PATTERNS:
                if pattern in resolved_str:
                    return False, f"Access to system sensitive path '{pattern}' is prohibited."

            return True, None
        except Exception as e:
            return False, f"Invalid path syntax: {e}"

    def validate_params(self, params: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        action = params.get("action")
        target_path = params.get("path")

        if not action or not target_path:
            return False, "Both 'action' and 'path' are required."

        if action not in ["list_dir", "read_file", "create_file", "create_folder", "delete_file"]:
            return False, f"Unknown action: '{action}'."

        safe, err = self._is_path_safe(target_path)
        if not safe:
            return False, err

        if action == "create_file" and "content" not in params:
            return False, "'content' parameter is required for 'create_file'."

        return True, None

    async def execute(self, params: Dict[str, Any]) -> ToolResult:
        action = params["action"]
        raw_path = params["path"]
        resolved_path = Path(raw_path).resolve()

        try:
            if action == "list_dir":
                return self._list_dir(resolved_path, params.get("max_items", 100))
            elif action == "read_file":
                return self._read_file(resolved_path)
            elif action == "create_file":
                return self._create_file(resolved_path, params.get("content", ""))
            elif action == "create_folder":
                return self._create_folder(resolved_path)
            elif action == "delete_file":
                return self._delete_file(resolved_path)
            else:
                return ToolResult(
                    success=False,
                    action_taken=action,
                    error=f"Unsupported action: {action}",
                )
        except Exception as e:
            logger.error("FileManagerTool action '%s' failed on '%s': %s", action, resolved_path, e)
            return ToolResult(
                success=False,
                action_taken=action,
                error=str(e),
                metadata={"path": str(resolved_path)},
            )

    def _list_dir(self, path: Path, max_items: int) -> ToolResult:
        if not path.exists():
            return ToolResult(
                success=False,
                action_taken="list_dir",
                error=f"Directory does not exist: {path}",
            )
        if not path.is_dir():
            return ToolResult(
                success=False,
                action_taken="list_dir",
                error=f"Path is not a directory: {path}",
            )

        entries: List[Dict[str, Any]] = []
        try:
            for item in sorted(path.iterdir(), key=lambda p: (not p.is_dir(), p.name.lower())):
                if len(entries) >= max_items:
                    break
                try:
                    stat = item.stat()
                    entries.append({
                        "name": item.name,
                        "is_dir": item.is_dir(),
                        "size_bytes": stat.st_size if not item.is_dir() else 0,
                        "modified_at": datetime.fromtimestamp(stat.st_mtime, timezone.utc).isoformat(),
                    })
                except (PermissionError, OSError):
                    continue

            return ToolResult(
                success=True,
                action_taken="list_dir",
                output={"path": str(path), "total_listed": len(entries), "entries": entries},
                metadata={"summary": f"Found {len(entries)} items in '{path.name or str(path)}'"},
            )
        except PermissionError:
            return ToolResult(
                success=False,
                action_taken="list_dir",
                error=f"Permission denied accessing directory: {path}",
            )

    def _read_file(self, path: Path) -> ToolResult:
        if not path.exists():
            return ToolResult(
                success=False,
                action_taken="read_file",
                error=f"File not found: {path}",
            )
        if not path.is_file():
            return ToolResult(
                success=False,
                action_taken="read_file",
                error=f"Target is not a regular file: {path}",
            )

        stat = path.stat()
        if stat.st_size > MAX_READ_BYTES:
            return ToolResult(
                success=False,
                action_taken="read_file",
                error=f"File size ({stat.st_size} bytes) exceeds maximum allowable read limit ({MAX_READ_BYTES} bytes).",
            )

        try:
            content = path.read_text(encoding="utf-8", errors="replace")
            return ToolResult(
                success=True,
                action_taken="read_file",
                output={"path": str(path), "size_bytes": stat.st_size, "content": content},
                metadata={"lines": len(content.splitlines()), "size": stat.st_size},
            )
        except Exception as e:
            return ToolResult(
                success=False,
                action_taken="read_file",
                error=f"Failed to read file: {e}",
            )

    def _create_file(self, path: Path, content: str) -> ToolResult:
        # Create parent directories if needed
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")
        return ToolResult(
            success=True,
            action_taken=f"Created file at '{path.name}'",
            output={"path": str(path), "bytes_written": len(content.encode("utf-8"))},
        )

    def _create_folder(self, path: Path) -> ToolResult:
        path.mkdir(parents=True, exist_ok=True)
        return ToolResult(
            success=True,
            action_taken=f"Created folder '{path.name}'",
            output={"path": str(path)},
        )

    def _delete_file(self, path: Path) -> ToolResult:
        if not path.exists():
            return ToolResult(
                success=False,
                action_taken="delete_file",
                error=f"File does not exist: {path}",
            )
        if path.is_dir():
            return ToolResult(
                success=False,
                action_taken="delete_file",
                error=f"Cannot delete directory '{path}'. Only file deletion is permitted via this tool.",
            )

        path.unlink()
        return ToolResult(
            success=True,
            action_taken=f"Deleted file '{path.name}'",
            output={"path": str(path)},
        )
