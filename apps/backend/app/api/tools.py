from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.models import ToolPermission
from app.database.session import get_db
from app.tools.desktop.app_launcher import AppLauncherTool
from app.tools.desktop.system_monitor import SystemMonitorTool
from app.tools.permissions import permission_manager
from app.tools.registry import tool_registry

router = APIRouter(prefix="/tools", tags=["tools"])


class ToolExecuteRequest(BaseModel):
    tool_name: str
    params: Dict[str, Any] = Field(default_factory=dict)
    approval_token: Optional[str] = None


class ToolApprovalRequest(BaseModel):
    token: str
    decision: str = "allow_once"  # allow_once, always_allow, deny


class ToolPermissionUpdateRequest(BaseModel):
    permission_level: str
    is_enabled: bool = True


@router.get("")
async def list_tools(db: AsyncSession = Depends(get_db)):
    """List all registered tools, their schemas, and current permission settings."""
    tools = tool_registry.list_tools()

    # Query DB permissions to enrich tools list
    stmt = select(ToolPermission)
    result = await db.execute(stmt)
    db_perms = {p.tool_name: p for p in result.scalars().all()}

    enriched = []
    for t in tools:
        t_name = t["name"]
        db_perm = db_perms.get(t_name)
        enriched.append({
            **t,
            "configured_permission": db_perm.permission_level if db_perm else t["permission_level"],
            "is_enabled": db_perm.is_enabled if db_perm else True,
        })

    return {"tools": enriched}


@router.get("/apps")
async def list_available_apps():
    """List whitelisted applications and their availability on this Windows host."""
    launcher: Optional[AppLauncherTool] = tool_registry.get_tool("launch_application")  # type: ignore
    if not launcher or not isinstance(launcher, AppLauncherTool):
        return {"apps": []}
    return {"apps": launcher.get_available_apps()}


@router.get("/system/stats")
async def get_system_stats():
    """Get live system telemetry (CPU, RAM, Battery, Disk, Uptime)."""
    monitor: Optional[SystemMonitorTool] = tool_registry.get_tool("system_monitor")  # type: ignore
    if not monitor or not isinstance(monitor, SystemMonitorTool):
        monitor = SystemMonitorTool()
    return monitor.get_quick_stats()


@router.get("/pending-approvals")
async def get_pending_approvals():
    """Get active pending tool execution approval requests."""
    return {"pending_approvals": permission_manager.list_pending_approvals()}


@router.post("/execute")
async def execute_tool(
    request: ToolExecuteRequest,
    db: AsyncSession = Depends(get_db),
):
    """Execute an automation tool, or receive an approval request if permission required."""
    res = await tool_registry.execute_tool(
        name=request.tool_name,
        params=request.params,
        approval_token=request.approval_token,
        db=db,
    )
    return res


@router.post("/approve")
async def approve_tool_execution(
    request: ToolApprovalRequest,
    db: AsyncSession = Depends(get_db),
):
    """Approve or deny a pending tool execution token.

    If approved with 'allow_once' or 'always_allow', executes the requested tool.
    """
    success, err, approval = await permission_manager.resolve_approval(
        token=request.token,
        decision=request.decision,
        db=db,
    )

    if not success or not approval:
        raise HTTPException(status_code=400, detail=err or "Approval failed")

    if request.decision == "deny":
        return {
            "status": "denied",
            "message": f"Execution of tool '{approval.tool_name}' was denied by user.",
            "token": request.token,
        }

    # Execute the approved action with the validated token
    execution_result = await tool_registry.execute_tool(
        name=approval.tool_name,
        params=approval.params,
        approval_token=request.token,
        db=db,
    )

    return {
        "status": "approved_and_executed",
        "decision": request.decision,
        "token": request.token,
        "tool": approval.tool_name,
        "execution": execution_result,
    }


@router.put("/{tool_name}/permission")
async def update_permission(
    tool_name: str,
    request: ToolPermissionUpdateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Update permission level or toggle enable/disable for a specific tool."""
    tool = tool_registry.get_tool(tool_name)
    if not tool:
        raise HTTPException(status_code=404, detail=f"Tool '{tool_name}' not found")

    if request.permission_level not in ["auto", "permission_required", "explicit_confirmation"]:
        raise HTTPException(
            status_code=400,
            detail="permission_level must be 'auto', 'permission_required', or 'explicit_confirmation'",
        )

    ok = await permission_manager.update_tool_permission(
        tool_name=tool_name,
        permission_level=request.permission_level,
        is_enabled=request.is_enabled,
        db=db,
    )

    if not ok:
        raise HTTPException(status_code=500, detail="Failed to save permission update")

    return {
        "tool_name": tool_name,
        "permission_level": request.permission_level,
        "is_enabled": request.is_enabled,
    }
