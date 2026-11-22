import json
import uuid
from typing import Any, Dict, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging_config import get_logger
from app.database.models import ActivityLog
from app.tools.base import BaseTool, PermissionLevel, ToolResult
from app.tools.desktop.app_launcher import AppLauncherTool
from app.tools.desktop.computer_control import ComputerControlTool
from app.tools.desktop.file_manager import FileManagerTool
from app.tools.desktop.system_control import SystemControlTool
from app.tools.desktop.system_monitor import SystemMonitorTool
from app.tools.desktop.volume_control import VolumeControlTool
from app.tools.developer.git_analyzer import GitAnalyzerTool
from app.tools.developer.project_analyzer import ProjectStructureTool
from app.tools.productivity.office_automation import OfficeAutomationTool
from app.tools.productivity.task_manager import TaskManagerTool
from app.tools.research.browser_automation import BrowserAutomationTool
from app.tools.research.web_reader import WebPageReaderTool
from app.tools.research.web_search import WebSearchTool
from app.tools.creative.creative_tools import CreativeSuiteTool
from app.tools.permissions import permission_manager

logger = get_logger(__name__)


class ToolRegistry:
    """Central registry and execution dispatcher for all NERO automation tools."""

    def __init__(self):
        self._tools: Dict[str, BaseTool] = {}
        self._register_default_tools()

    def _register_default_tools(self) -> None:
        """Register the built-in desktop, developer, research, and productivity tools."""
        self.register(SystemMonitorTool())
        self.register(AppLauncherTool())
        self.register(FileManagerTool())
        self.register(VolumeControlTool())
        self.register(WebSearchTool())
        self.register(WebPageReaderTool())
        self.register(GitAnalyzerTool())
        self.register(ProjectStructureTool())
        self.register(TaskManagerTool())
        self.register(ComputerControlTool())
        self.register(SystemControlTool())
        self.register(OfficeAutomationTool())
        self.register(BrowserAutomationTool())
        self.register(CreativeSuiteTool())
        logger.info("Registered %d automation tools", len(self._tools))

    def register(self, tool: BaseTool) -> None:
        self._tools[tool.name] = tool

    def get_tool(self, name: str) -> Optional[BaseTool]:
        return self._tools.get(name)

    def list_tools(self) -> List[Dict[str, Any]]:
        return [tool.to_dict() for tool in self._tools.values()]

    async def execute_tool(
        self,
        name: str,
        params: Dict[str, Any],
        approval_token: Optional[str] = None,
        db: Optional[AsyncSession] = None,
        bypass_permission: bool = False,
    ) -> Dict[str, Any]:
        """Validate, check permissions, and execute a tool safely."""
        tool = self.get_tool(name)
        if not tool:
            return {
                "status": "error",
                "message": f"Tool '{name}' not found.",
                "tool": name,
            }

        # 1. Validate parameters
        is_valid, validation_err = tool.validate_params(params)
        if not is_valid:
            return {
                "status": "error",
                "message": f"Invalid parameters for tool '{name}': {validation_err}",
                "tool": name,
            }

        # 2. Check permission level
        # Note: If tool is file_manager and action is delete_file, force explicit confirmation
        effective_level = tool.permission_level
        if name == "file_manager" and params.get("action") == "delete_file":
            effective_level = PermissionLevel.EXPLICIT_CONFIRMATION

        perm_str, is_enabled = await permission_manager.get_tool_permission(
            name, effective_level, db
        )

        if not is_enabled:
            return {
                "status": "error",
                "message": f"Tool '{name}' is disabled by user policy.",
                "tool": name,
            }

        # If effective level requires explicit confirmation (e.g. delete_file), override even if general tool is auto
        if effective_level == PermissionLevel.EXPLICIT_CONFIRMATION:
            perm_str = PermissionLevel.EXPLICIT_CONFIRMATION.value

        # 3. Handle Permission & Approval
        if not bypass_permission and perm_str in (
            PermissionLevel.PERMISSION_REQUIRED.value,
            PermissionLevel.EXPLICIT_CONFIRMATION.value,
        ):
            if not approval_token:
                reason = (
                    f"Action '{params.get('action') or name}' requires user confirmation"
                    if perm_str == PermissionLevel.EXPLICIT_CONFIRMATION.value
                    else f"Executing '{name}' requires user permission"
                )
                approval_req = permission_manager.create_approval_request(
                    tool_name=name,
                    params=params,
                    reason=reason,
                    permission_level=perm_str,
                )
                return {
                    "status": "approval_required",
                    "approval": approval_req,
                    "tool": name,
                    "params": params,
                }

            # If approval token was provided, verify it
            approval = permission_manager.get_approval(approval_token)
            if not approval or approval.status != "approved":
                return {
                    "status": "error",
                    "message": "Invalid, unapproved, or expired approval token.",
                    "tool": name,
                }

        # 4. Execute tool
        try:
            result: ToolResult = await tool.execute(params)

            # 5. Log activity
            if db is not None:
                try:
                    log_entry = ActivityLog(
                        id=str(uuid.uuid4()),
                        action_type=f"tool_execution:{name}",
                        description=result.action_taken,
                        action_metadata=json.dumps({
                            "params": params,
                            "success": result.success,
                            "permission_level": perm_str,
                            "error": result.error,
                        }),
                    )
                    db.add(log_entry)
                    await db.commit()
                except Exception as log_err:
                    logger.warning("Failed to record tool activity log: %s", log_err)

            return {
                "status": "success" if result.success else "error",
                "tool": name,
                "result": result.model_dump(),
            }

        except Exception as e:
            logger.error("Unhandled error executing tool %s: %s", name, e)
            return {
                "status": "error",
                "message": f"Execution failed: {str(e)}",
                "tool": name,
            }


tool_registry = ToolRegistry()
