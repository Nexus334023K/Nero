import os
import shutil
import subprocess
from typing import Any, Dict, Optional, Tuple

from app.core.logging_config import get_logger
from app.tools.base import BaseTool, PermissionLevel, ToolResult

logger = get_logger(__name__)


class GitAnalyzerTool(BaseTool):
    """Tool for analyzing Git repositories: branches, commit history,

    staged changes, working tree status, and diff statistics.
    """

    name = "git_analyzer"
    description = (
        "Inspect Git repositories: check status, current branch, recent commit history, "
        "and file diff statistics for a repository directory."
    )
    permission_level = PermissionLevel.AUTO
    parameters_schema = {
        "type": "object",
        "properties": {
            "action": {
                "type": "string",
                "enum": ["status", "log", "branch", "diff_stat"],
                "default": "status",
                "description": "Git analysis action to execute.",
            },
            "repo_path": {
                "type": "string",
                "default": "D:\\Nero",
                "description": "Filesystem path to the Git repository root.",
            },
            "limit": {
                "type": "integer",
                "default": 5,
                "description": "Max number of commits to list when action is 'log'.",
            },
        },
    }

    def _has_git(self) -> bool:
        return shutil.which("git") is not None

    def validate_params(self, params: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        repo_path = params.get("repo_path", "D:\\Nero")
        norm = os.path.normpath(repo_path)
        if not os.path.isdir(norm):
            return False, f"Repository path does not exist: '{norm}'"
        return True, None

    async def execute(self, params: Dict[str, Any]) -> ToolResult:
        if not self._has_git():
            return ToolResult(
                success=False,
                action_taken="git_analyzer",
                error="Git binary is not installed or not found in system PATH.",
            )

        action = params.get("action", "status")
        repo_path = os.path.normpath(params.get("repo_path", "D:\\Nero"))
        limit = min(20, max(1, int(params.get("limit", 5))))

        try:
            if action == "status":
                # Branch
                branch_proc = subprocess.run(
                    ["git", "branch", "--show-current"],
                    cwd=repo_path,
                    capture_output=True,
                    text=True,
                    shell=False,
                    timeout=5,
                )
                current_branch = branch_proc.stdout.strip() or "HEAD (detached)"

                # Short status
                status_proc = subprocess.run(
                    ["git", "status", "--short"],
                    cwd=repo_path,
                    capture_output=True,
                    text=True,
                    shell=False,
                    timeout=5,
                )
                raw_status = status_proc.stdout.strip()
                changed_files = [line.strip() for line in raw_status.splitlines() if line.strip()]

                return ToolResult(
                    success=True,
                    action_taken="Checked Git repository status",
                    output={
                        "repo_path": repo_path,
                        "branch": current_branch,
                        "is_clean": len(changed_files) == 0,
                        "changed_files_count": len(changed_files),
                        "changed_files": changed_files,
                    },
                    metadata={
                        "summary": f"Branch: {current_branch} | Clean: {len(changed_files) == 0} ({len(changed_files)} changes)"
                    },
                )

            elif action == "log":
                log_proc = subprocess.run(
                    ["git", "log", f"-n{limit}", "--pretty=format:%h - %an, %ar : %s"],
                    cwd=repo_path,
                    capture_output=True,
                    text=True,
                    shell=False,
                    timeout=5,
                )
                commits = [line.strip() for line in log_proc.stdout.strip().splitlines() if line.strip()]
                return ToolResult(
                    success=True,
                    action_taken=f"Retrieved {len(commits)} recent Git commits",
                    output={"repo_path": repo_path, "commits": commits},
                    metadata={"summary": f"Recent commits:\n" + "\n".join(commits[:3])},
                )

            elif action == "branch":
                b_proc = subprocess.run(
                    ["git", "branch", "-a"],
                    cwd=repo_path,
                    capture_output=True,
                    text=True,
                    shell=False,
                    timeout=5,
                )
                branches = [line.strip() for line in b_proc.stdout.strip().splitlines() if line.strip()]
                return ToolResult(
                    success=True,
                    action_taken="Listed Git branches",
                    output={"repo_path": repo_path, "branches": branches},
                )

            elif action == "diff_stat":
                diff_proc = subprocess.run(
                    ["git", "diff", "--stat"],
                    cwd=repo_path,
                    capture_output=True,
                    text=True,
                    shell=False,
                    timeout=5,
                )
                diff_output = diff_proc.stdout.strip() or "No uncommitted modifications."
                return ToolResult(
                    success=True,
                    action_taken="Retrieved Git diff stats",
                    output={"repo_path": repo_path, "diff_stat": diff_output},
                )

            return ToolResult(
                success=False,
                action_taken=action,
                error=f"Unsupported git action: {action}",
            )

        except subprocess.TimeoutExpired:
            return ToolResult(success=False, action_taken=action, error="Git command timed out.")
        except Exception as e:
            logger.error("GitAnalyzerTool failed on %s: %s", repo_path, e)
            return ToolResult(success=False, action_taken=action, error=str(e))
