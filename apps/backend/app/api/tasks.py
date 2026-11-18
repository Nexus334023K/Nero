import os
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging_config import get_logger
from app.database.models import BackgroundTask, User
from app.database.session import get_db
from app.engine.task_engine import task_engine
from app.schemas.tasks import (
    TaskActionResponse,
    TaskCreateRequest,
    TaskListResponse,
    TaskProgressResponse,
    TaskResponse,
    TaskSteerRequest,
)

logger = get_logger(__name__)

router = APIRouter(prefix="/tasks", tags=["tasks"])

DEFAULT_USER_ID = "00000000-0000-0000-0000-000000000001"


async def _ensure_default_user(db: AsyncSession) -> None:
    res = await db.execute(select(User).where(User.id == DEFAULT_USER_ID))
    if not res.scalar_one_or_none():
        db.add(User(id=DEFAULT_USER_ID, name="Default User"))
        await db.commit()


def _format_task_response(task: BackgroundTask) -> TaskResponse:
    return TaskResponse(
        id=task.id,
        user_id=task.user_id,
        request=task.request,
        title=task.title,
        assigned_agent=task.assigned_agent,
        status=task.status,
        current_step=task.current_step,
        total_steps=task.total_steps,
        progress=task.progress,
        plan=task.plan,
        step_results=task.step_results,
        checkpoint=task.checkpoint,
        steering_instructions=task.steering_instructions,
        error_info=task.error_info,
        final_result=task.final_result,
        report_path=task.report_path,
        created_at=task.created_at.isoformat() if task.created_at else "",
        updated_at=task.updated_at.isoformat() if task.updated_at else "",
    )


@router.post("", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
async def create_task(
    payload: TaskCreateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Create and start a new background task."""
    await _ensure_default_user(db)
    agent = payload.assigned_agent.lower()
    if agent not in ("general", "research"):
        agent = "general"

    task = await task_engine.create_task(
        user_id=DEFAULT_USER_ID,
        request=payload.request,
        title=payload.title,
        assigned_agent=agent,
        db=db,
    )
    return _format_task_response(task)


@router.get("", response_model=TaskListResponse)
async def list_tasks(
    status_filter: Optional[str] = Query(None, alias="status"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """List background tasks with optional status filter."""
    stmt = select(BackgroundTask).order_by(desc(BackgroundTask.created_at))
    if status_filter:
        stmt = stmt.where(BackgroundTask.status == status_filter)

    result = await db.execute(stmt)
    all_tasks = result.scalars().all()
    paginated = all_tasks[offset : offset + limit]

    return TaskListResponse(
        tasks=[_format_task_response(t) for t in paginated],
        total=len(all_tasks),
    )


@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(task_id: str, db: AsyncSession = Depends(get_db)):
    """Get full details of a background task."""
    stmt = select(BackgroundTask).where(BackgroundTask.id == task_id)
    res = await db.execute(stmt)
    task = res.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail=f"Task '{task_id}' not found.")
    return _format_task_response(task)


@router.get("/{task_id}/progress", response_model=TaskProgressResponse)
async def get_task_progress(task_id: str, db: AsyncSession = Depends(get_db)):
    """Get lightweight progress metrics for polling."""
    stmt = select(BackgroundTask).where(BackgroundTask.id == task_id)
    res = await db.execute(stmt)
    task = res.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail=f"Task '{task_id}' not found.")

    curr_title = None
    if task.plan and 0 < task.current_step <= len(task.plan):
        curr_title = task.plan[task.current_step - 1].get("title")

    return TaskProgressResponse(
        task_id=task.id,
        status=task.status,
        progress=task.progress,
        current_step=task.current_step,
        total_steps=task.total_steps,
        current_step_title=curr_title,
        updated_at=task.updated_at.isoformat() if task.updated_at else "",
    )


@router.post("/{task_id}/pause", response_model=TaskActionResponse)
async def pause_task(task_id: str):
    """Pause an active task."""
    success = await task_engine.pause_task(task_id)
    if not success:
        raise HTTPException(status_code=400, detail="Cannot pause task; task may not be running.")
    return TaskActionResponse(
        success=True,
        message="Task paused successfully.",
        task_id=task_id,
        status="paused",
    )


@router.post("/{task_id}/resume", response_model=TaskActionResponse)
async def resume_task(task_id: str):
    """Resume a paused task."""
    success = await task_engine.resume_task(task_id)
    if not success:
        raise HTTPException(status_code=400, detail="Cannot resume task; task not found or already completed.")
    return TaskActionResponse(
        success=True,
        message="Task resumed successfully.",
        task_id=task_id,
        status="queued",
    )


@router.post("/{task_id}/cancel", response_model=TaskActionResponse)
async def cancel_task(task_id: str):
    """Cancel a task."""
    success = await task_engine.cancel_task(task_id)
    return TaskActionResponse(
        success=success,
        message="Task cancelled." if success else "Failed to cancel task.",
        task_id=task_id,
        status="cancelled",
    )


@router.post("/{task_id}/steer", response_model=TaskActionResponse)
async def steer_task(task_id: str, payload: TaskSteerRequest):
    """Inject a live steering directive into a running or queued task."""
    success = await task_engine.steer_task(task_id, payload.instruction)
    if not success:
        raise HTTPException(status_code=400, detail="Could not apply steering instruction.")
    return TaskActionResponse(
        success=True,
        message="Steering instruction accepted.",
        task_id=task_id,
        status="steered",
    )


@router.post("/{task_id}/finish-early", response_model=TaskActionResponse)
async def finish_early_task(task_id: str):
    """Instruct task to stop further steps and synthesize early output."""
    success = await task_engine.finish_early(task_id)
    return TaskActionResponse(
        success=success,
        message="Early completion initiated.",
        task_id=task_id,
        status="finishing_early",
    )


@router.post("/{task_id}/retry", response_model=TaskActionResponse)
async def retry_task(task_id: str):
    """Retry a failed or cancelled task from the beginning."""
    success = await task_engine.retry_task(task_id)
    if not success:
        raise HTTPException(status_code=400, detail="Cannot retry task.")
    return TaskActionResponse(
        success=True,
        message="Task reset and queued for execution.",
        task_id=task_id,
        status="queued",
    )


@router.get("/{task_id}/report")
async def get_task_report(task_id: str, db: AsyncSession = Depends(get_db)):
    """Retrieve markdown content of the compiled task report."""
    stmt = select(BackgroundTask).where(BackgroundTask.id == task_id)
    res = await db.execute(stmt)
    task = res.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found.")

    report_content = None
    if task.report_path and os.path.exists(task.report_path):
        try:
            report_content = Path(task.report_path).read_text(encoding="utf-8")
        except Exception as e:
            logger.warning("Could not read report file at %s: %s", task.report_path, e)

    if not report_content:
        report_content = task.final_result or "No report content generated for this task."

    return {
        "task_id": task_id,
        "title": task.title,
        "report_markdown": report_content,
        "report_path": task.report_path,
    }


@router.delete("/{task_id}", response_model=TaskActionResponse)
async def delete_task(task_id: str, db: AsyncSession = Depends(get_db)):
    """Delete a task and its stored report file."""
    stmt = select(BackgroundTask).where(BackgroundTask.id == task_id)
    res = await db.execute(stmt)
    task = res.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found.")

    # Remove report file if it exists
    if task.report_path and os.path.exists(task.report_path):
        try:
            os.remove(task.report_path)
        except Exception as e:
            logger.warning("Failed to remove report file %s: %s", task.report_path, e)

    await db.delete(task)
    await db.commit()

    return TaskActionResponse(
        success=True,
        message="Task deleted successfully.",
        task_id=task_id,
        status="deleted",
    )
