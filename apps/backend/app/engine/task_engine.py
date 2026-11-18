import asyncio
from datetime import datetime, timezone
from typing import Any, Callable, Dict, List, Optional
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging_config import get_logger
from app.database.models import BackgroundTask
from app.database.session import AsyncSessionLocal
from app.agents.registry import agent_registry
from app.agents.research_pipeline import ResearchAgent

logger = get_logger(__name__)


class TaskEngine:
    """Persistent background task engine managing autonomous agent execution,

    checkpointing, pause/resume, live steering, early finish, and recovery.
    """

    def __init__(self):
        self._active_tasks: Dict[str, asyncio.Task] = {}
        self._pause_flags: Dict[str, bool] = {}
        self._cancel_flags: Dict[str, bool] = {}
        self._early_finish_flags: Dict[str, bool] = {}
        self._steering_queues: Dict[str, List[str]] = {}
        self._event_listeners: List[Callable[[str, str, Dict[str, Any]], None]] = []

    def register_listener(self, listener: Callable[[str, str, Dict[str, Any]], None]):
        """Register listener for task state events: (task_id, event_type, payload)."""
        self._event_listeners.append(listener)

    def _notify(self, task_id: str, event_type: str, payload: Dict[str, Any]):
        for listener in self._event_listeners:
            try:
                listener(task_id, event_type, payload)
            except Exception as e:
                logger.warning("Error in task event listener: %s", e)

    async def startup(self):
        """Recover tasks that were running or planning when backend stopped."""
        logger.info("Initializing TaskEngine startup recovery...")
        async with AsyncSessionLocal() as session:
            try:
                stmt = select(BackgroundTask).where(
                    BackgroundTask.status.in_(["running", "planning"])
                )
                result = await session.execute(stmt)
                interrupted_tasks = result.scalars().all()

                for task in interrupted_tasks:
                    logger.warning(
                        "Task %s (%s) was interrupted in status '%s'. Pausing with checkpoint intact.",
                        task.id,
                        task.title,
                        task.status,
                    )
                    task.status = "paused"
                    task.error_info = (
                        f"Application restarted while task was in '{task.status}' state. "
                        f"Safely paused at step {task.current_step}/{task.total_steps}. Ready to resume."
                    )
                await session.commit()
            except Exception as e:
                await session.rollback()
                logger.error("Failed during TaskEngine startup recovery: %s", e)

    async def shutdown(self):
        """Gracefully handle active background tasks during backend shutdown."""
        logger.info("TaskEngine shutting down. Pausing %d active task workers...", len(self._active_tasks))
        for task_id in list(self._active_tasks.keys()):
            self._pause_flags[task_id] = True

        # Wait briefly for tasks to acknowledge pause
        if self._active_tasks:
            await asyncio.sleep(0.5)

    async def create_task(
        self,
        user_id: str,
        request: str,
        title: Optional[str] = None,
        assigned_agent: str = "general",
        db: Optional[AsyncSession] = None,
    ) -> BackgroundTask:
        """Create and queue a new background task."""
        auto_title = title or (request[:60] + "..." if len(request) > 60 else request)

        task = BackgroundTask(
            user_id=user_id,
            request=request,
            title=auto_title,
            assigned_agent=assigned_agent,
            status="queued",
            current_step=0,
            total_steps=0,
            progress=0.0,
            plan=[],
            step_results=[],
            checkpoint=None,
            steering_instructions=[],
        )

        close_session = False
        if db is None:
            db = AsyncSessionLocal()
            close_session = True

        try:
            db.add(task)
            await db.commit()
            await db.refresh(task)
            task_id = task.id
        finally:
            if close_session:
                await db.close()

        # Start background worker immediately
        self.start_task(task_id)
        return task

    def start_task(self, task_id: str):
        """Launch background worker for a queued or resumed task."""
        if task_id in self._active_tasks and not self._active_tasks[task_id].done():
            logger.info("Task %s is already running in background.", task_id)
            return

        self._pause_flags[task_id] = False
        self._cancel_flags[task_id] = False
        self._early_finish_flags[task_id] = False
        worker_task = asyncio.create_task(self._run_task_worker(task_id))
        self._active_tasks[task_id] = worker_task

    async def pause_task(self, task_id: str) -> bool:
        """Signal a task to pause execution and save checkpoint."""
        self._pause_flags[task_id] = True
        async with AsyncSessionLocal() as session:
            stmt = select(BackgroundTask).where(BackgroundTask.id == task_id)
            res = await session.execute(stmt)
            task = res.scalar_one_or_none()
            if task and task.status in ("running", "queued", "planning"):
                task.status = "paused"
                await session.commit()
                self._notify(task_id, "paused", {"status": "paused"})
                return True
        return False

    async def resume_task(self, task_id: str) -> bool:
        """Resume a paused, failed, or cancelled task from its latest checkpoint."""
        async with AsyncSessionLocal() as session:
            stmt = select(BackgroundTask).where(BackgroundTask.id == task_id)
            res = await session.execute(stmt)
            task = res.scalar_one_or_none()
            if not task:
                return False

            if task.status in ("completed",):
                return False

            task.status = "queued"
            task.error_info = None
            await session.commit()

        self._notify(task_id, "resumed", {"status": "queued"})
        self.start_task(task_id)
        return True

    async def cancel_task(self, task_id: str) -> bool:
        """Cancel a running or paused task."""
        self._cancel_flags[task_id] = True
        if task_id in self._active_tasks and not self._active_tasks[task_id].done():
            self._active_tasks[task_id].cancel()

        async with AsyncSessionLocal() as session:
            stmt = select(BackgroundTask).where(BackgroundTask.id == task_id)
            res = await session.execute(stmt)
            task = res.scalar_one_or_none()
            if task and task.status not in ("completed", "cancelled"):
                task.status = "cancelled"
                await session.commit()
                self._notify(task_id, "cancelled", {"status": "cancelled"})
                return True
        return True

    async def steer_task(self, task_id: str, instruction: str) -> bool:
        """Inject a live steering directive to influence current and upcoming steps."""
        if not instruction.strip():
            return False

        if task_id not in self._steering_queues:
            self._steering_queues[task_id] = []
        self._steering_queues[task_id].append(instruction.strip())

        async with AsyncSessionLocal() as session:
            stmt = select(BackgroundTask).where(BackgroundTask.id == task_id)
            res = await session.execute(stmt)
            task = res.scalar_one_or_none()
            if task:
                current_steer = list(task.steering_instructions or [])
                current_steer.append({
                    "instruction": instruction.strip(),
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                })
                task.steering_instructions = current_steer
                await session.commit()
                self._notify(task_id, "steered", {"instruction": instruction.strip()})
                return True
        return False

    async def finish_early(self, task_id: str) -> bool:
        """Order agent to stop executing further steps and immediately synthesize output."""
        self._early_finish_flags[task_id] = True
        return True

    async def retry_task(self, task_id: str) -> bool:
        """Reset task progress and re-run from the beginning."""
        async with AsyncSessionLocal() as session:
            stmt = select(BackgroundTask).where(BackgroundTask.id == task_id)
            res = await session.execute(stmt)
            task = res.scalar_one_or_none()
            if not task:
                return False

            task.status = "queued"
            task.current_step = 0
            task.progress = 0.0
            task.plan = []
            task.step_results = []
            task.checkpoint = None
            task.error_info = None
            task.final_result = None
            task.report_path = None
            await session.commit()

        self.start_task(task_id)
        return True

    async def _run_task_worker(self, task_id: str):
        """Core execution loop for background tasks."""
        logger.info("Starting background task worker for %s", task_id)

        try:
            # 1. Fetch task
            async with AsyncSessionLocal() as session:
                stmt = select(BackgroundTask).where(BackgroundTask.id == task_id)
                res = await session.execute(stmt)
                task = res.scalar_one_or_none()
                if not task:
                    logger.error("Task %s not found in database.", task_id)
                    return

                agent_name = task.assigned_agent or "general"
                request_text = task.request
                plan = task.plan or []
                step_results = list(task.step_results or [])
                checkpoint = task.checkpoint or {}
                accumulated_context = checkpoint.get("accumulated_context", {"request": request_text})

            agent = agent_registry.get(agent_name) or agent_registry.get("general")

            # 2. Planning phase if no plan exists yet
            if not plan:
                async with AsyncSessionLocal() as session:
                    stmt = select(BackgroundTask).where(BackgroundTask.id == task_id)
                    res = await session.execute(stmt)
                    t = res.scalar_one()
                    t.status = "planning"
                    await session.commit()
                self._notify(task_id, "planning", {"status": "planning"})

                plan = await agent.plan(request_text, accumulated_context)

                async with AsyncSessionLocal() as session:
                    stmt = select(BackgroundTask).where(BackgroundTask.id == task_id)
                    res = await session.execute(stmt)
                    t = res.scalar_one()
                    t.plan = plan
                    t.total_steps = len(plan)
                    t.status = "running"
                    await session.commit()
                self._notify(task_id, "planned", {"total_steps": len(plan)})

            total_steps = len(plan)
            completed_step = checkpoint.get("completed_step", 0)

            # 3. Step execution loop
            for idx in range(completed_step, total_steps):
                step_number = idx + 1
                step_info = plan[idx]

                # Check pause, cancel, early-finish flags
                if self._cancel_flags.get(task_id):
                    async with AsyncSessionLocal() as session:
                        stmt = select(BackgroundTask).where(BackgroundTask.id == task_id)
                        res = await session.execute(stmt)
                        t = res.scalar_one()
                        t.status = "cancelled"
                        await session.commit()
                    self._notify(task_id, "cancelled", {"status": "cancelled"})
                    return

                if self._pause_flags.get(task_id):
                    async with AsyncSessionLocal() as session:
                        stmt = select(BackgroundTask).where(BackgroundTask.id == task_id)
                        res = await session.execute(stmt)
                        t = res.scalar_one()
                        t.status = "paused"
                        await session.commit()
                    self._notify(task_id, "paused", {"status": "paused", "at_step": step_number})
                    return

                if self._early_finish_flags.get(task_id):
                    logger.info("Task %s received early finish signal at step %d", task_id, step_number)
                    break

                # Update progress
                current_progress = round((idx / total_steps) * 100, 1)
                plan[idx]["status"] = "running"
                plan[idx]["started_at"] = datetime.now(timezone.utc).isoformat()

                async with AsyncSessionLocal() as session:
                    stmt = select(BackgroundTask).where(BackgroundTask.id == task_id)
                    res = await session.execute(stmt)
                    t = res.scalar_one()
                    t.status = "running"
                    t.current_step = step_number
                    t.progress = current_progress
                    t.plan = list(plan)
                    await session.commit()

                self._notify(task_id, "step_started", {
                    "step_number": step_number,
                    "title": step_info.get("title", ""),
                    "progress": current_progress,
                })

                # Retrieve any queued steering instructions
                pending_steering = []
                if task_id in self._steering_queues and self._steering_queues[task_id]:
                    pending_steering = list(self._steering_queues[task_id])
                    self._steering_queues[task_id].clear()

                # Execute step through agent
                step_output = await agent.execute_step(
                    task_id=task_id,
                    step_number=step_number,
                    step_info=step_info,
                    accumulated_context=accumulated_context,
                    steering_instructions=pending_steering if pending_steering else None,
                )

                # Record step result
                plan[idx]["status"] = "completed"
                plan[idx]["output"] = step_output.get("summary", "Step executed successfully.")
                plan[idx]["completed_at"] = datetime.now(timezone.utc).isoformat()

                step_results.append({
                    "step_number": step_number,
                    "title": step_info.get("title", ""),
                    "summary": step_output.get("summary", ""),
                    "output": step_output,
                    "completed_at": plan[idx]["completed_at"],
                })

                # Checkpoint persistence
                step_progress = round((step_number / total_steps) * 100, 1)
                new_checkpoint = {
                    "completed_step": step_number,
                    "accumulated_context": accumulated_context,
                    "saved_at": datetime.now(timezone.utc).isoformat(),
                }

                async with AsyncSessionLocal() as session:
                    stmt = select(BackgroundTask).where(BackgroundTask.id == task_id)
                    res = await session.execute(stmt)
                    t = res.scalar_one()
                    t.current_step = step_number
                    t.progress = step_progress
                    t.plan = list(plan)
                    t.step_results = list(step_results)
                    t.checkpoint = new_checkpoint
                    if "report_path" in accumulated_context:
                        t.report_path = accumulated_context["report_path"]
                    await session.commit()

                self._notify(task_id, "step_completed", {
                    "step_number": step_number,
                    "progress": step_progress,
                    "summary": step_output.get("summary", ""),
                })

            # 4. Final completion or early finish synthesis
            if self._early_finish_flags.get(task_id):
                if isinstance(agent, ResearchAgent):
                    rep_md, rep_p = agent.synthesize_early_report(task_id, request_text, accumulated_context)
                    accumulated_context["report_markdown"] = rep_md
                    accumulated_context["report_path"] = str(rep_p)
                    final_text = f"Research early synthesis created at {rep_p.name}."
                else:
                    final_text = "Task finished early per user request with accumulated findings."
            else:
                final_text = accumulated_context.get("final_result") or accumulated_context.get("report_markdown")
                if not final_text:
                    final_text = f"Successfully executed all {total_steps} planned steps for '{request_text}'."

            rep_path = accumulated_context.get("report_path")

            async with AsyncSessionLocal() as session:
                stmt = select(BackgroundTask).where(BackgroundTask.id == task_id)
                res = await session.execute(stmt)
                t = res.scalar_one()
                t.status = "completed"
                t.progress = 100.0
                t.current_step = total_steps
                t.final_result = final_text
                if rep_path:
                    t.report_path = rep_path
                await session.commit()

            self._notify(task_id, "completed", {
                "status": "completed",
                "progress": 100.0,
                "final_result": final_text,
                "report_path": rep_path,
            })
            logger.info("Task %s completed successfully.", task_id)

        except asyncio.CancelledError:
            logger.info("Task worker %s cancelled.", task_id)
        except Exception as e:
            logger.exception("Error executing task worker %s: %s", task_id, e)
            async with AsyncSessionLocal() as session:
                try:
                    stmt = select(BackgroundTask).where(BackgroundTask.id == task_id)
                    res = await session.execute(stmt)
                    t = res.scalar_one_or_none()
                    if t:
                        t.status = "failed"
                        t.error_info = str(e)
                        await session.commit()
                except Exception as inner_e:
                    logger.error("Failed to mark task %s as failed: %s", task_id, inner_e)
            self._notify(task_id, "failed", {"error": str(e)})

        finally:
            self._active_tasks.pop(task_id, None)
            self._pause_flags.pop(task_id, None)
            self._cancel_flags.pop(task_id, None)
            self._early_finish_flags.pop(task_id, None)
            self._steering_queues.pop(task_id, None)


# Global singleton
task_engine = TaskEngine()
