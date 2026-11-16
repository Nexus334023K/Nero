import uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.models import Project, Task, User
from app.database.session import get_db

router = APIRouter(prefix="/productivity", tags=["productivity"])

DEFAULT_USER_ID = "00000000-0000-0000-0000-000000000001"


async def _ensure_default_user(db: AsyncSession) -> None:
    res = await db.execute(select(User).where(User.id == DEFAULT_USER_ID))
    if not res.scalar_one_or_none():
        db.add(User(id=DEFAULT_USER_ID, name="Default User"))
        await db.commit()


# Schemas
class TaskCreateRequest(BaseModel):
    title: str = Field(..., min_length=1)
    description: Optional[str] = None
    priority: str = Field(default="medium")  # low, medium, high, urgent
    project_id: Optional[str] = None
    due_date: Optional[datetime] = None


class TaskUpdateRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None  # pending, in_progress, completed, cancelled
    due_date: Optional[datetime] = None


class ProjectCreateRequest(BaseModel):
    name: str = Field(..., min_length=1)
    description: Optional[str] = None
    root_path: Optional[str] = None


# Endpoints
@router.get("/tasks")
async def list_tasks(
    status: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    project_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    await _ensure_default_user(db)
    stmt = select(Task).where(Task.user_id == DEFAULT_USER_ID)

    if status:
        stmt = stmt.where(Task.status == status)
    if priority:
        stmt = stmt.where(Task.priority == priority)
    if project_id:
        stmt = stmt.where(Task.project_id == project_id)

    stmt = stmt.order_by(Task.created_at.desc())
    result = await db.execute(stmt)
    tasks = result.scalars().all()

    return {
        "tasks": [
            {
                "id": t.id,
                "title": t.title,
                "description": t.description,
                "priority": t.priority,
                "status": t.status,
                "project_id": t.project_id,
                "due_date": t.due_date.isoformat() if t.due_date else None,
                "created_at": t.created_at.isoformat() if t.created_at else None,
            }
            for t in tasks
        ]
    }


@router.post("/tasks")
async def create_task(
    req: TaskCreateRequest,
    db: AsyncSession = Depends(get_db),
):
    await _ensure_default_user(db)
    new_task = Task(
        id=str(uuid.uuid4()),
        user_id=DEFAULT_USER_ID,
        title=req.title.strip(),
        description=req.description.strip() if req.description else None,
        priority=req.priority.lower(),
        project_id=req.project_id,
        due_date=req.due_date,
        status="pending",
    )
    db.add(new_task)
    await db.commit()

    return {
        "success": True,
        "task": {
            "id": new_task.id,
            "title": new_task.title,
            "priority": new_task.priority,
            "status": new_task.status,
            "created_at": new_task.created_at.isoformat() if new_task.created_at else None,
        },
    }


@router.patch("/tasks/{task_id}")
async def update_task(
    task_id: str,
    req: TaskUpdateRequest,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Task).where(Task.id == task_id)
    result = await db.execute(stmt)
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if req.title is not None:
        task.title = req.title.strip()
    if req.description is not None:
        task.description = req.description.strip()
    if req.priority is not None:
        task.priority = req.priority.lower()
    if req.status is not None:
        task.status = req.status.lower()
    if req.due_date is not None:
        task.due_date = req.due_date

    await db.commit()
    return {"success": True, "task": {"id": task.id, "title": task.title, "status": task.status}}


@router.delete("/tasks/{task_id}")
async def delete_task(
    task_id: str,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Task).where(Task.id == task_id)
    result = await db.execute(stmt)
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    await db.delete(task)
    await db.commit()
    return {"success": True, "id": task_id}


@router.get("/projects")
async def list_projects(db: AsyncSession = Depends(get_db)):
    await _ensure_default_user(db)
    stmt = select(Project).where(Project.user_id == DEFAULT_USER_ID).order_by(Project.created_at.desc())
    result = await db.execute(stmt)
    projects = result.scalars().all()

    return {
        "projects": [
            {
                "id": p.id,
                "name": p.name,
                "description": p.description,
                "root_path": p.root_path,
                "status": p.status,
                "created_at": p.created_at.isoformat() if p.created_at else None,
            }
            for p in projects
        ]
    }


@router.post("/projects")
async def create_project(
    req: ProjectCreateRequest,
    db: AsyncSession = Depends(get_db),
):
    await _ensure_default_user(db)
    new_project = Project(
        id=str(uuid.uuid4()),
        user_id=DEFAULT_USER_ID,
        name=req.name.strip(),
        description=req.description.strip() if req.description else None,
        root_path=req.root_path.strip() if req.root_path else None,
        status="active",
    )
    db.add(new_project)
    await db.commit()

    return {
        "success": True,
        "project": {
            "id": new_project.id,
            "name": new_project.name,
            "status": new_project.status,
        },
    }


@router.delete("/projects/{project_id}")
async def delete_project(
    project_id: str,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Project).where(Project.id == project_id)
    result = await db.execute(stmt)
    proj = result.scalar_one_or_none()
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")

    await db.delete(proj)
    await db.commit()
    return {"success": True, "id": project_id}


@router.get("/briefing")
async def get_daily_briefing(db: AsyncSession = Depends(get_db)):
    await _ensure_default_user(db)
    # Tasks
    t_stmt = (
        select(Task)
        .where(Task.user_id == DEFAULT_USER_ID, Task.status == "pending")
        .order_by(Task.created_at.desc())
    )
    t_res = await db.execute(t_stmt)
    pending_tasks = t_res.scalars().all()

    # Projects
    p_stmt = select(Project).where(Project.user_id == DEFAULT_USER_ID)
    p_res = await db.execute(p_stmt)
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

    return {
        "greeting": greeting,
        "date": now_dt.isoformat(),
        "formatted_date": now_dt.strftime("%A, %B %d, %Y"),
        "pending_tasks_count": len(pending_tasks),
        "urgent_tasks_count": urgent_count,
        "active_projects_count": len(projects),
        "top_tasks": [
            {"id": t.id, "title": t.title, "priority": t.priority}
            for t in pending_tasks[:5]
        ],
    }
