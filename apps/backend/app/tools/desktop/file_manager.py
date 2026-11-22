from datetime import datetime, timezone
import hashlib
import os
from pathlib import Path
import shutil
from typing import Any, Dict, List, Optional, Tuple
import zipfile

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

# Category mappings for automatic folder organization
FILE_CATEGORIES: Dict[str, List[str]] = {
    "Documents": [".pdf", ".docx", ".doc", ".txt", ".xlsx", ".xls", ".pptx", ".ppt", ".csv", ".rtf", ".odt"],
    "Images": [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".svg", ".webp", ".ico", ".tiff"],
    "Videos": [".mp4", ".mkv", ".mov", ".avi", ".wmv", ".flv", ".webm", ".m4v"],
    "Audio": [".mp3", ".wav", ".flac", ".m4a", ".aac", ".ogg", ".wma"],
    "Archives": [".zip", ".rar", ".7z", ".tar", ".gz", ".bz2"],
    "Code": [".py", ".js", ".ts", ".tsx", ".jsx", ".html", ".css", ".json", ".xml", ".yaml", ".yml", ".sql", ".sh", ".ps1"],
    "Executables": [".exe", ".msi", ".bat", ".cmd"],
}


class FileManagerTool(BaseTool):
    """Tool for safe filesystem interactions: listing directories, reading/writing files,
    organizing folders, search, archives, and guarded deletion.
    """

    name = "file_manager"
    description = (
        "Perform comprehensive file and folder operations: list directories, read, create, edit, "
        "rename, copy, move, delete files/folders, search files, organize folders (e.g. Downloads or Desktop), "
        "manage ZIP archives, and detect large or duplicate files."
    )
    permission_level = PermissionLevel.AUTO
    parameters_schema = {
        "type": "object",
        "properties": {
            "action": {
                "type": "string",
                "enum": [
                    "list_dir",
                    "read_file",
                    "create_file",
                    "edit_file",
                    "create_folder",
                    "rename",
                    "copy",
                    "move",
                    "delete_file",
                    "delete_folder",
                    "search_files",
                    "organize_folder",
                    "create_archive",
                    "extract_archive",
                    "find_large_files",
                    "find_duplicates",
                ],
                "description": "Filesystem operation to perform.",
            },
            "path": {
                "type": "string",
                "description": "Target file or directory path.",
            },
            "destination": {
                "type": "string",
                "description": "Destination path for copy, move, rename, or archive extraction.",
            },
            "content": {
                "type": "string",
                "description": "Content to write or append when creating/editing files.",
            },
            "pattern": {
                "type": "string",
                "description": "Search pattern (e.g. '*.png', '*screenshot*', or text keyword).",
            },
            "max_items": {
                "type": "integer",
                "default": 100,
                "description": "Maximum number of directory entries to list.",
            },
            "min_size_mb": {
                "type": "number",
                "default": 50,
                "description": "Minimum size in MB when searching for large files.",
            },
            "mode": {
                "type": "string",
                "enum": ["overwrite", "append"],
                "default": "overwrite",
                "description": "Write mode for edit_file.",
            },
        },
        "required": ["action", "path"],
    }

    def _resolve_special_paths(self, path_str: str) -> Path:
        """Resolve common natural paths like 'Desktop', 'Downloads', 'Documents'."""
        cleaned = path_str.strip().strip("\"'")
        lower = cleaned.lower()

        user_home = Path.home()
        if lower in ("desktop", "my desktop", "~/desktop"):
            return user_home / "Desktop"
        elif lower in ("downloads", "my downloads", "~/downloads"):
            return user_home / "Downloads"
        elif lower in ("documents", "my documents", "~/documents"):
            return user_home / "Documents"
        elif lower in ("pictures", "my pictures", "~/pictures"):
            return user_home / "Pictures"
        elif lower in ("videos", "my videos", "~/videos"):
            return user_home / "Videos"
        elif lower.startswith("desktop\\") or lower.startswith("desktop/"):
            return user_home / "Desktop" / cleaned[8:]
        elif lower.startswith("downloads\\") or lower.startswith("downloads/"):
            return user_home / "Downloads" / cleaned[10:]
        elif lower.startswith("documents\\") or lower.startswith("documents/"):
            return user_home / "Documents" / cleaned[10:]

        return Path(cleaned).resolve()

    def _is_path_safe(self, target_path: Any) -> Tuple[bool, Optional[str]]:
        try:
            resolved_str = str(Path(target_path).resolve()).lower()
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

        resolved = self._resolve_special_paths(target_path)
        safe, err = self._is_path_safe(resolved)
        if not safe:
            return False, err

        if action in ("copy", "move", "rename") and not params.get("destination"):
            return False, f"Action '{action}' requires 'destination'."

        return True, None

    async def execute(self, params: Dict[str, Any]) -> ToolResult:
        action = params["action"]
        resolved_path = self._resolve_special_paths(params["path"])

        try:
            if action == "list_dir":
                return self._list_dir(resolved_path, params.get("max_items", 100))
            elif action == "read_file":
                return self._read_file(resolved_path)
            elif action == "create_file":
                return self._create_file(resolved_path, params.get("content", ""))
            elif action == "edit_file":
                return self._edit_file(resolved_path, params.get("content", ""), params.get("mode", "overwrite"))
            elif action == "create_folder":
                return self._create_folder(resolved_path)
            elif action == "rename":
                dest = self._resolve_special_paths(params["destination"])
                return self._rename(resolved_path, dest)
            elif action == "copy":
                dest = self._resolve_special_paths(params["destination"])
                return self._copy(resolved_path, dest)
            elif action == "move":
                dest = self._resolve_special_paths(params["destination"])
                return self._move(resolved_path, dest)
            elif action == "delete_file":
                return self._delete_file(resolved_path)
            elif action == "delete_folder":
                return self._delete_folder(resolved_path)
            elif action == "search_files":
                return self._search_files(resolved_path, params.get("pattern", "*"), params.get("max_items", 50))
            elif action == "organize_folder":
                return self._organize_folder(resolved_path)
            elif action == "create_archive":
                dest = self._resolve_special_paths(params.get("destination", f"{resolved_path}.zip"))
                return self._create_archive(resolved_path, dest)
            elif action == "extract_archive":
                dest = self._resolve_special_paths(params.get("destination", str(resolved_path.parent)))
                return self._extract_archive(resolved_path, dest)
            elif action == "find_large_files":
                min_mb = float(params.get("min_size_mb", 50))
                return self._find_large_files(resolved_path, min_mb)
            elif action == "find_duplicates":
                return self._find_duplicates(resolved_path)
            else:
                return ToolResult(
                    success=False,
                    action_taken=action,
                    error=f"Unsupported action: {action}",
                )
        except Exception as e:
            logger.error("FileManagerTool error on '%s': %s", action, e)
            return ToolResult(
                success=False,
                action_taken=action,
                error=str(e),
                metadata={"path": str(resolved_path)},
            )

    # ------------------ Core File Operations ------------------

    def _list_dir(self, path: Path, max_items: int) -> ToolResult:
        if not path.exists():
            return ToolResult(success=False, action_taken="list_dir", error=f"Directory does not exist: {path}")
        if not path.is_dir():
            return ToolResult(success=False, action_taken="list_dir", error=f"Path is not a directory: {path}")

        entries: List[Dict[str, Any]] = []
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

    def _read_file(self, path: Path) -> ToolResult:
        if not path.exists():
            return ToolResult(success=False, action_taken="read_file", error=f"File not found: {path}")
        if not path.is_file():
            return ToolResult(success=False, action_taken="read_file", error=f"Target is not a regular file: {path}")

        stat = path.stat()
        if stat.st_size > MAX_READ_BYTES:
            return ToolResult(
                success=False,
                action_taken="read_file",
                error=f"File size ({stat.st_size} bytes) exceeds limit ({MAX_READ_BYTES} bytes).",
            )

        content = path.read_text(encoding="utf-8", errors="replace")
        return ToolResult(
            success=True,
            action_taken="read_file",
            output={"path": str(path), "size_bytes": stat.st_size, "content": content},
            metadata={"lines": len(content.splitlines()), "size": stat.st_size},
        )

    def _create_file(self, path: Path, content: str) -> ToolResult:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")
        return ToolResult(
            success=path.exists(),
            action_taken="create_file",
            output={"path": str(path), "bytes_written": len(content.encode("utf-8")), "verified": path.exists()},
        )

    def _edit_file(self, path: Path, content: str, mode: str = "overwrite") -> ToolResult:
        if not path.exists():
            return self._create_file(path, content)

        if mode == "append":
            with open(path, "a", encoding="utf-8") as f:
                f.write(content)
        else:
            path.write_text(content, encoding="utf-8")

        return ToolResult(
            success=True,
            action_taken="edit_file",
            output={"path": str(path), "mode": mode, "new_size": path.stat().st_size},
        )

    def _create_folder(self, path: Path) -> ToolResult:
        path.mkdir(parents=True, exist_ok=True)
        verified = path.exists() and path.is_dir()
        return ToolResult(
            success=verified,
            action_taken="create_folder",
            output={"path": str(path), "verified": verified},
        )

    def _rename(self, source: Path, destination: Path) -> ToolResult:
        if not source.exists():
            return ToolResult(success=False, action_taken="rename", error=f"Source does not exist: {source}")
        destination.parent.mkdir(parents=True, exist_ok=True)
        source.rename(destination)
        return ToolResult(
            success=destination.exists(),
            action_taken="rename",
            output={"from": str(source), "to": str(destination)},
        )

    def _copy(self, source: Path, destination: Path) -> ToolResult:
        if not source.exists():
            return ToolResult(success=False, action_taken="copy", error=f"Source does not exist: {source}")

        if source.is_dir():
            if destination.exists():
                destination = destination / source.name
            shutil.copytree(source, destination, dirs_exist_ok=True)
        else:
            if destination.is_dir():
                destination = destination / source.name
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, destination)

        return ToolResult(
            success=destination.exists(),
            action_taken="copy",
            output={"from": str(source), "to": str(destination)},
        )

    def _move(self, source: Path, destination: Path) -> ToolResult:
        if not source.exists():
            return ToolResult(success=False, action_taken="move", error=f"Source does not exist: {source}")

        if destination.is_dir():
            destination = destination / source.name
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(source), str(destination))

        return ToolResult(
            success=destination.exists(),
            action_taken="move",
            output={"from": str(source), "to": str(destination)},
        )

    def _delete_file(self, path: Path) -> ToolResult:
        if not path.exists():
            return ToolResult(success=False, action_taken="delete_file", error=f"File does not exist: {path}")
        if path.is_dir():
            return ToolResult(success=False, action_taken="delete_file", error="Target is a directory. Use delete_folder.")

        path.unlink()
        return ToolResult(success=not path.exists(), action_taken="delete_file", output={"path": str(path)})

    def _delete_folder(self, path: Path) -> ToolResult:
        if not path.exists() or not path.is_dir():
            return ToolResult(success=False, action_taken="delete_folder", error=f"Directory does not exist: {path}")

        # Protect entire drive root or sensitive folders
        if len(path.resolve().parts) <= 2:
            return ToolResult(success=False, action_taken="delete_folder", error="Refusing to delete top-level directory.")

        shutil.rmtree(path)
        return ToolResult(success=not path.exists(), action_taken="delete_folder", output={"path": str(path)})

    # ------------------ Advanced File Operations ------------------

    def _search_files(self, path: Path, pattern: str, max_items: int = 50) -> ToolResult:
        if not path.exists() or not path.is_dir():
            return ToolResult(success=False, action_taken="search_files", error=f"Directory not found: {path}")

        matches: List[Dict[str, Any]] = []
        clean_pat = pattern.strip()

        for root, _, files in os.walk(path):
            for f in files:
                if len(matches) >= max_items:
                    break
                p = Path(root) / f
                # Match wildcard or substring
                if p.match(clean_pat) or clean_pat.lower() in f.lower():
                    try:
                        stat = p.stat()
                        matches.append({
                            "name": f,
                            "path": str(p),
                            "size_bytes": stat.st_size,
                            "modified": datetime.fromtimestamp(stat.st_mtime, timezone.utc).isoformat(),
                        })
                    except Exception:
                        continue
            if len(matches) >= max_items:
                break

        return ToolResult(
            success=True,
            action_taken="search_files",
            output={"count": len(matches), "matches": matches},
            metadata={"search_dir": str(path), "pattern": pattern},
        )

    def _organize_folder(self, path: Path) -> ToolResult:
        """Categorize files into subdirectories (Documents, Images, Videos, etc.)."""
        if not path.exists() or not path.is_dir():
            return ToolResult(success=False, action_taken="organize_folder", error=f"Directory not found: {path}")

        moved_files: List[Dict[str, str]] = []
        stats: Dict[str, int] = {cat: 0 for cat in FILE_CATEGORIES}
        stats["Others"] = 0

        for item in list(path.iterdir()):
            if item.is_dir() or item.name.startswith("."):
                continue

            ext = item.suffix.lower()
            target_category = "Others"
            for cat, extensions in FILE_CATEGORIES.items():
                if ext in extensions:
                    target_category = cat
                    break

            cat_dir = path / target_category
            cat_dir.mkdir(parents=True, exist_ok=True)
            dest = cat_dir / item.name

            # Prevent overwriting
            if dest.exists():
                stem = item.stem
                counter = 1
                while dest.exists():
                    dest = cat_dir / f"{stem}_{counter}{ext}"
                    counter += 1

            shutil.move(str(item), str(dest))
            moved_files.append({"file": item.name, "category": target_category, "to": str(dest)})
            stats[target_category] += 1

        return ToolResult(
            success=True,
            action_taken="organize_folder",
            output={
                "target_directory": str(path),
                "total_organized": len(moved_files),
                "breakdown": {k: v for k, v in stats.items() if v > 0},
                "moved_files": moved_files[:30],
            },
        )

    def _create_archive(self, source: Path, dest_zip: Path) -> ToolResult:
        dest_zip.parent.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(dest_zip, "w", zipfile.ZIP_DEFLATED) as zipf:
            if source.is_dir():
                for root, _, files in os.walk(source):
                    for file in files:
                        p = Path(root) / file
                        arcname = p.relative_to(source)
                        zipf.write(p, arcname)
            else:
                zipf.write(source, source.name)

        return ToolResult(
            success=dest_zip.exists(),
            action_taken="create_archive",
            output={"archive_path": str(dest_zip), "size_bytes": dest_zip.stat().st_size},
        )

    def _extract_archive(self, zip_path: Path, dest_dir: Path) -> ToolResult:
        if not zip_path.exists() or not zipfile.is_zipfile(zip_path):
            return ToolResult(success=False, action_taken="extract_archive", error=f"Invalid zip file: {zip_path}")

        dest_dir.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(zip_path, "r") as zipf:
            zipf.extractall(dest_dir)

        return ToolResult(
            success=True,
            action_taken="extract_archive",
            output={"extracted_to": str(dest_dir)},
        )

    def _find_large_files(self, path: Path, min_mb: float = 50) -> ToolResult:
        min_bytes = int(min_mb * 1024 * 1024)
        large_files: List[Dict[str, Any]] = []

        for root, _, files in os.walk(path):
            for file in files:
                p = Path(root) / file
                try:
                    size = p.stat().st_size
                    if size >= min_bytes:
                        large_files.append({
                            "name": file,
                            "path": str(p),
                            "size_mb": round(size / (1024 * 1024), 2),
                        })
                except Exception:
                    continue

        large_files.sort(key=lambda x: x["size_mb"], reverse=True)
        return ToolResult(
            success=True,
            action_taken="find_large_files",
            output={"count": len(large_files), "files": large_files[:30]},
        )

    def _find_duplicates(self, path: Path) -> ToolResult:
        size_map: Dict[int, List[Path]] = {}
        for root, _, files in os.walk(path):
            for file in files:
                p = Path(root) / file
                try:
                    sz = p.stat().st_size
                    if sz > 1024:  # ignore tiny files
                        size_map.setdefault(sz, []).append(p)
                except Exception:
                    continue

        duplicates: List[Dict[str, Any]] = []
        for sz, candidates in size_map.items():
            if len(candidates) < 2:
                continue
            hash_map: Dict[str, List[str]] = {}
            for cand in candidates:
                try:
                    h = hashlib.sha256(cand.read_bytes()).hexdigest()
                    hash_map.setdefault(h, []).append(str(cand))
                except Exception:
                    continue
            for h, file_paths in hash_map.items():
                if len(file_paths) > 1:
                    duplicates.append({
                        "hash": h,
                        "size_mb": round(sz / (1024 * 1024), 2),
                        "paths": file_paths,
                    })

        return ToolResult(
            success=True,
            action_taken="find_duplicates",
            output={"duplicate_groups": len(duplicates), "duplicates": duplicates[:20]},
        )
