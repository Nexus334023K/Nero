import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional, Tuple
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging_config import get_logger
from app.database.models import ToolPermission
from app.tools.base import PermissionLevel

logger = get_logger(__name__)


class PendingApproval:
    def __init__(
        self,
        token: str,
        tool_name: str,
        params: Dict[str, Any],
        permission_level: str,
        reason: str,
        ttl_seconds: int = 300,
    ):
        self.token = token
        self.tool_name = tool_name
        self.params = params
        self.permission_level = permission_level
        self.reason = reason
        self.created_at = datetime.now(timezone.utc)
        self.expires_at = self.created_at + timedelta(seconds=ttl_seconds)
        self.status = "pending"  # pending, approved, denied, expired

    def is_expired(self) -> bool:
        return datetime.now(timezone.utc) > self.expires_at

    def to_dict(self) -> Dict[str, Any]:
        return {
            "token": self.token,
            "tool_name": self.tool_name,
            "params": self.params,
            "permission_level": self.permission_level,
            "reason": self.reason,
            "created_at": self.created_at.isoformat(),
            "expires_at": self.expires_at.isoformat(),
            "status": "expired" if self.is_expired() and self.status == "pending" else self.status,
        }


class PermissionManager:
    """Manages multi-tiered permission checking, execution approval tokens,

    and security enforcement for desktop tools.
    """

    def __init__(self):
        self._pending_approvals: Dict[str, PendingApproval] = {}

    async def get_tool_permission(
        self, tool_name: str, default_level: PermissionLevel, db: Optional[AsyncSession] = None
    ) -> Tuple[str, bool]:
        """Fetch permission level and enabled state from database if available."""
        if db is not None:
            try:
                stmt = select(ToolPermission).where(ToolPermission.tool_name == tool_name)
                result = await db.execute(stmt)
                record = result.scalar_one_or_none()
                if record is not None:
                    return record.permission_level, record.is_enabled
            except Exception as e:
                logger.warning("Error fetching tool permission from DB for %s: %s", tool_name, e)

        return default_level.value, True

    def create_approval_request(
        self,
        tool_name: str,
        params: Dict[str, Any],
        reason: str,
        permission_level: str,
        ttl_seconds: int = 300,
    ) -> Dict[str, Any]:
        """Generate a secure approval token for a requested tool execution."""
        # Cleanup expired requests
        self._cleanup_expired()

        token = f"tok_{uuid.uuid4().hex[:16]}"
        approval = PendingApproval(
            token=token,
            tool_name=tool_name,
            params=params,
            permission_level=permission_level,
            reason=reason,
            ttl_seconds=ttl_seconds,
        )
        self._pending_approvals[token] = approval
        logger.info(
            "Created approval request token %s for tool %s (%s)",
            token,
            tool_name,
            permission_level,
        )
        return approval.to_dict()

    def get_approval(self, token: str) -> Optional[PendingApproval]:
        """Retrieve approval by token if valid and not expired."""
        approval = self._pending_approvals.get(token)
        if not approval:
            return None
        if approval.is_expired():
            approval.status = "expired"
            return None
        return approval

    async def resolve_approval(
        self,
        token: str,
        decision: str,  # allow_once | always_allow | deny
        db: Optional[AsyncSession] = None,
    ) -> Tuple[bool, Optional[str], Optional[PendingApproval]]:
        """Resolve a pending approval token with a user decision."""
        approval = self.get_approval(token)
        if not approval:
            return False, "Approval token not found or expired", None

        if approval.status != "pending":
            return False, f"Approval token already resolved as '{approval.status}'", None

        if decision == "deny":
            approval.status = "denied"
            logger.info("Approval denied for token %s (%s)", token, approval.tool_name)
            return True, None, approval

        if decision in ("allow_once", "always_allow"):
            approval.status = "approved"
            logger.info("Approval granted (%s) for token %s (%s)", decision, token, approval.tool_name)

            if decision == "always_allow" and db is not None:
                # Update tool permission to 'auto' in database
                try:
                    stmt = select(ToolPermission).where(ToolPermission.tool_name == approval.tool_name)
                    result = await db.execute(stmt)
                    record = result.scalar_one_or_none()
                    if record:
                        record.permission_level = PermissionLevel.AUTO.value
                        record.is_enabled = True
                    else:
                        new_perm = ToolPermission(
                            id=str(uuid.uuid4()),
                            tool_name=approval.tool_name,
                            permission_level=PermissionLevel.AUTO.value,
                            is_enabled=True,
                        )
                        db.add(new_perm)
                    await db.commit()
                    logger.info("Updated tool %s permission to 'auto' (always_allow)", approval.tool_name)
                except Exception as e:
                    logger.error("Failed to persist always_allow permission: %s", e)

            return True, None, approval

        return False, f"Invalid decision: {decision}. Use 'allow_once', 'always_allow', or 'deny'", None

    async def update_tool_permission(
        self,
        tool_name: str,
        permission_level: str,
        is_enabled: bool,
        db: AsyncSession,
    ) -> bool:
        """Explicitly update tool permission level and active state in database."""
        try:
            stmt = select(ToolPermission).where(ToolPermission.tool_name == tool_name)
            result = await db.execute(stmt)
            record = result.scalar_one_or_none()
            if record:
                record.permission_level = permission_level
                record.is_enabled = is_enabled
            else:
                new_perm = ToolPermission(
                    id=str(uuid.uuid4()),
                    tool_name=tool_name,
                    permission_level=permission_level,
                    is_enabled=is_enabled,
                )
                db.add(new_perm)
            await db.commit()
            return True
        except Exception as e:
            logger.error("Failed to update tool permission for %s: %s", tool_name, e)
            await db.rollback()
            return False

    def list_pending_approvals(self) -> list[Dict[str, Any]]:
        """Return list of active pending approval requests."""
        self._cleanup_expired()
        return [
            appr.to_dict()
            for appr in self._pending_approvals.values()
            if appr.status == "pending" and not appr.is_expired()
        ]

    def _cleanup_expired(self) -> None:
        """Prune expired pending tokens."""
        now = datetime.now(timezone.utc)
        to_delete = [
            token
            for token, appr in self._pending_approvals.items()
            if appr.expires_at < now and (appr.status in ("pending", "expired"))
        ]
        for token in to_delete:
            del self._pending_approvals[token]


permission_manager = PermissionManager()
