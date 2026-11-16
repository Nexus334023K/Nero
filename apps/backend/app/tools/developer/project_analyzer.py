import json
import os
from collections import Counter
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from app.core.logging_config import get_logger
from app.tools.base import BaseTool, PermissionLevel, ToolResult

logger = get_logger(__name__)

IGNORE_DIRS = {
    ".git",
    "node_modules",
    "__pycache__",
    ".venv",
    "venv",
    "dist",
    "dist-electron",
    "build",
    ".idea",
    ".vscode",
    "coverage",
}


class ProjectStructureTool(BaseTool):
    """Tool for analyzing workspace project structures, detected technology stack,

    file metrics, and dependency declarations.
    """

    name = "project_structure"
    description = (
        "Analyze a workspace or project directory: detect programming languages, "
        "frameworks, file distribution, and directory layout."
    )
    permission_level = PermissionLevel.AUTO
    parameters_schema = {
        "type": "object",
        "properties": {
            "path": {
                "type": "string",
                "default": "D:\\Nero",
                "description": "Path to the project or repository root directory.",
            },
            "max_depth": {
                "type": "integer",
                "default": 3,
                "description": "Maximum directory traversal depth.",
            },
        },
    }

    def validate_params(self, params: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        path_str = params.get("path", "D:\\Nero")
        if not os.path.isdir(path_str):
            return False, f"Directory does not exist: '{path_str}'"
        return True, None

    def _detect_tech_stack(self, root: Path) -> List[str]:
        stack: List[str] = []

        # Node / TypeScript
        if (root / "package.json").exists():
            stack.append("Node.js")
            try:
                pkg = json.loads((root / "package.json").read_text(encoding="utf-8", errors="ignore"))
                deps = {**pkg.get("dependencies", {}), **pkg.get("devDependencies", {})}
                if "electron" in deps:
                    stack.append("Electron")
                if "react" in deps:
                    stack.append("React")
                if "vite" in deps:
                    stack.append("Vite")
                if "typescript" in deps or (root / "tsconfig.json").exists():
                    stack.append("TypeScript")
            except Exception:
                pass

        # Python
        if (
            (root / "requirements.txt").exists()
            or (root / "pyproject.toml").exists()
            or any(root.glob("*.py"))
            or (root / "apps" / "backend").exists()
        ):
            stack.append("Python")
            # Check FastAPI
            for req_file in [root / "requirements.txt", root / "apps" / "backend" / "requirements.txt"]:
                if req_file.exists():
                    try:
                        content = req_file.read_text(encoding="utf-8", errors="ignore")
                        if "fastapi" in content.lower():
                            stack.append("FastAPI")
                        if "chromadb" in content.lower():
                            stack.append("ChromaDB")
                        if "sqlalchemy" in content.lower():
                            stack.append("SQLAlchemy")
                    except Exception:
                        pass

        # Rust
        if (root / "Cargo.toml").exists():
            stack.append("Rust")

        # Go
        if (root / "go.mod").exists():
            stack.append("Go")

        return list(dict.fromkeys(stack))

    def _build_tree(self, root: Path, max_depth: int) -> List[Dict[str, Any]]:
        tree: List[Dict[str, Any]] = []

        def recurse(curr: Path, depth: int) -> Dict[str, Any]:
            node: Dict[str, Any] = {
                "name": curr.name or str(curr),
                "is_dir": curr.is_dir(),
            }
            if curr.is_dir() and depth < max_depth:
                children = []
                try:
                    for child in sorted(curr.iterdir(), key=lambda p: (not p.is_dir(), p.name.lower())):
                        if child.name in IGNORE_DIRS:
                            continue
                        children.append(recurse(child, depth + 1))
                except (PermissionError, OSError):
                    pass
                node["children"] = children
            return node

        try:
            for child in sorted(root.iterdir(), key=lambda p: (not p.is_dir(), p.name.lower())):
                if child.name in IGNORE_DIRS:
                    continue
                tree.append(recurse(child, 1))
        except (PermissionError, OSError):
            pass

        return tree

    async def execute(self, params: Dict[str, Any]) -> ToolResult:
        root_path = Path(params.get("path", "D:\\Nero")).resolve()
        max_depth = min(5, max(1, int(params.get("max_depth", 3))))

        extensions: Counter = Counter()
        total_files = 0
        total_dirs = 0

        for dirpath, dirnames, filenames in os.walk(root_path):
            # prune ignored dirs in place
            dirnames[:] = [d for d in dirnames if d not in IGNORE_DIRS]
            total_dirs += len(dirnames)

            for f in filenames:
                total_files += 1
                ext = Path(f).suffix.lower()
                if ext:
                    extensions[ext] += 1
                else:
                    extensions["[no extension]"] += 1

        tech_stack = self._detect_tech_stack(root_path)
        tree = self._build_tree(root_path, max_depth)

        summary = (
            f"Project at '{root_path.name}': Detected Stack: {', '.join(tech_stack) or 'Generic'} | "
            f"Total Files: {total_files} across {total_dirs} directories."
        )

        return ToolResult(
            success=True,
            action_taken=f"Analyzed project structure for '{root_path.name}'",
            output={
                "project_name": root_path.name,
                "project_path": str(root_path),
                "tech_stack": tech_stack,
                "total_files": total_files,
                "total_directories": total_dirs,
                "top_extensions": dict(extensions.most_common(8)),
                "tree_preview": tree[:10],
            },
            metadata={"summary": summary},
        )
