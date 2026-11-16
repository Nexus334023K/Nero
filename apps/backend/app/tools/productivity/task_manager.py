import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging_config import get_logger
from app.database.models import Project, Task
from app.database.session import AsyncSessionLocal
from app.tools.base import BaseTool, PermissionLevel, ToolResult

logger = get_logger(__name__)

DEFAULT_USER_ID = "00000000-0000-0000-0000-000000000001"


class TaskManagerTool(BaseTool):
    """Tool for managing tasks, to-dos, priorities, deadlines, and generating daily briefings."""

    name = "task_manager"
    description = (
        "Create, list, update, and complete tasks or generate a daily productivity briefing. "
        "Allows user to stay organized with task priorities and due dates."
    )
    permission_level = PermissionLevel.AUTO
    parameters_schema = {
        "type": "object",
        "properties": {
            "action": {
                "type": "string",
                "enum": ["list_tasks", "create_task", "complete_task", "delete_task", "daily_briefing"],
                "default": "list_tasks",
                "description": "Task management operation.",
            },
            "title": {
                "type": "string",
                "description": "Task title (required for create_task).",
            },
            "description": {
                "type": "string",
                "description": "Optional detailed task description.",
            },
            "priority": {
                "type": "string",
                "enum": ["low", "medium", "high", "urgent"],
                "default": "medium",
                "description": "Task priority level.",
            },
            "task_id": {
                "type": "string",
                "description": "UUID of task to complete or delete.",
            },
            "status_filter": {
                "type": "string",
                "enum": ["all", "pending", "completed"],
                "default": "pending",
                "description": "Filter criteria when listing tasks.",
            },
        },
    }

    def validate_params(self, params: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        action = params.get("action", "list_tasks")
        if action == "create_task" and not params.get("title", "").strip():
            return False, "'title' parameter is required for 'create_task'."
        if action in ("complete_task", "delete_task") and not params.get("task_id"):
            return False, f"'task_id' is required for '{action}'."
        return True, None

    async def execute(self, params: Dict[str, Any]) -> ToolResult:
        action = params.get("action", "list_tasks")

        async with AsyncSessionLocal() as session:
            try:
                if action == "create_task":
                    task_id = str(uuid.uuid4())
                    title = params["title"].strip()
                    priority = params.get("priority", "medium").lower()
                    desc = params.get("description", "").strip() or None

                    new_task = Task(
                        id=task_id,
                        user_id=DEFAULT_USER_ID,
                        title=title,
                        description=desc,
                        priority=priority,
                        status="pending",
                    )
                    session.add(new_task)
                    await session.commit()

                    return ToolResult(
                        success=True,
                        action_taken=f"Created task '{title}'",
                        output={
                            "id": task_id,
                            "title": title,
                            "priority": priority,
                            "status": "pending",
                        },
                        metadata={"summary": f"Added task: '{title}' [{priority.upper()}]"},
                    )

                elif action == "list_tasks":
                    filter_status = params.get("status_filter", "pending")
                    stmt = select(Task).where(Task.user_id == DEFAULT_USER_ID)
                    if filter_status == "pending":
                        stmt = stmt.where(Task.status.in_(["pending", "in_progress"]))
                    elif filter_status == "completed":
                        stmt = stmt.where(Task.status == "completed")

                    stmt = stmt.order_by(Task.created_at.desc())
                    res = await session.execute(stmt)
                    tasks = res.scalars().all()

                    task_items = [
                        {
                            "id": t.id,
                            "title": t.title,
                            "description": t.description,
                            "priority": t.priority,
                            "status": t.status,
                            "created_at": t.created_at.isoformat() if t.created_at else None,
                        }
                        for t in tasks
                    ]

                    return ToolResult(
                        success=True,
                        action_taken=f"Listed {len(task_items)} tasks",
                        output={"tasks": task_items, "filter": filter_status},
                        metadata={"summary": f"Found {len(task_items)} {filter_status} tasks"},
                    )

                elif action == "complete_task":
                    task_id = params["task_id"]
                    stmt = select(Task).where(Task.id == task_id)
                    res = await session.execute(stmt)
                    task = res.scalar_one_or_none()

                    if not task:
                        return ToolResult(
                            success=False,
                            action_taken="complete_task",
                            error=f"Task '{task_id}' not found.",
                        )

                    task.status = "completed"
                    await session.commit()

                    return ToolResult(
                        success=True,
                        action_taken=f"Marked task '{task.title}' as completed",
                        output={"id": task.id, "title": task.title, "status": "completed"},
                    )

                elif action == "delete_task":
                    task_id = params["task_id"]
                    stmt = select(Task).where(Task.id == task_id)
                    res = await session.execute(stmt)
                    task = res.scalar_one_or_none()

                    if not task:
                        return ToolResult(
                            success=False,
                            action_taken="delete_task",
                            error=f"Task '{task_id}' not found.",
                        )

                    await session.delete(task)
                    await session.commit()

                    return ToolResult(
                        success=True,
                        action_taken=f"Deleted task '{task.title}'",
                        output={"id": task_id},
                    )

                elif action == "daily_briefing":
                    # Pending tasks
                    t_stmt = (
                        select(Task)
                        .where(Task.user_id == DEFAULT_USER_ID, Task.status == "pending")
                        .order_by(Task.created_at.desc())
                    )
                    t_res = await session.execute(t_stmt)
                    pending_tasks = t_res.scalars().all()

                    # Projects
                    p_stmt = select(Project).where(Project.user_id == DEFAULT_USER_ID)
                    p_res = await session.execute(p_stmt)
                    projects = p_res.scalars().all()

                    now_dt = datetime.now(timezone.utc)
                    greeting = (
                        "Good morning"
                        if 5 <= now_dt.hour < 12
                        else "Good afternoon"
                        if 12 <= now_dt.hour < 17
                        else "Good evening"
                    )

                    urgent_count = sum(1 for t in pending_tasks if t.priority in ("high", "urgent"))

                    briefing_text = (
                        f"{greeting}! Here is your daily productivity briefing:\n"
                        f"• Date: {now_dt.strftime('%A, %B %d, %Y')}\n"
                        f"• Active Tasks: {len(pending_tasks)} pending ({urgent_count} high priority)\n"
                        f"• Active Projects: {len(projects)}"
                    )
                    if pending_tasks:
                        briefing_text += "\n\nTop Pending Tasks:\n" + "\n".join(
                            [f"  - [{t.priority.upper()}] {t.title}" for t in pending_tasks[:5]]
                        )

                    return ToolResult(
                        success=True,
                        action_taken="Generated daily briefing",
                        output={
                            "date": now_dt.isoformat(),
                            "greeting": greeting,
                            "pending_count": len(pending_tasks),
                            "urgent_count": urgent_count,
                            "projects_count": len(projects),
                            "briefing": briefing_text,
                        },
                        metadata={"summary": briefing_text},
                    )

                return ToolResult(
                    success=False,
                    action_taken=action,
                    error=f"Unsupported action: '{action}'",
                )

            except Exception as e:
                logger.error("TaskManagerTool failed: %s", e)
                return ToolResult(success=False, action_taken=action, error=str(e))
