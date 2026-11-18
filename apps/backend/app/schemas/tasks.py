from datetime import datetime
from typing import Any
from pydantic import BaseModel, ConfigDict, Field


class TaskCreateRequest(BaseModel):
    request: str = Field(..., min_length=1, description="The user's goal or research query")
    title: str | None = Field(None, description="Optional short descriptive title")
    assigned_agent: str = Field("general", description="Agent assigned to the task: 'general' or 'research'")


class TaskSteerRequest(BaseModel):
    instruction: str = Field(..., min_length=1, description="Steering instruction to guide the running task")


class TaskStepItem(BaseModel):
    step_number: int
    title: str
    description: str = ""
    status: str = "pending"  # pending, running, completed, failed, skipped
    output: str | None = None
    started_at: str | None = None
    completed_at: str | None = None


class TaskProgressResponse(BaseModel):
    task_id: str
    status: str
    progress: float
    current_step: int
    total_steps: int
    current_step_title: str | None = None
    updated_at: str


class TaskResponse(BaseModel):
    id: str
    user_id: str
    request: str
    title: str
    assigned_agent: str
    status: str
    current_step: int
    total_steps: int
    progress: float
    plan: list[dict[str, Any]] | dict[str, Any] | None = None
    step_results: list[dict[str, Any]] | None = None
    checkpoint: dict[str, Any] | None = None
    steering_instructions: list[dict[str, Any] | str] | None = None
    error_info: str | None = None
    final_result: str | None = None
    report_path: str | None = None
    created_at: str
    updated_at: str

    model_config = ConfigDict(from_attributes=True)


class TaskListResponse(BaseModel):
    tasks: list[TaskResponse]
    total: int


class TaskActionResponse(BaseModel):
    success: bool
    message: str
    task_id: str
    status: str
