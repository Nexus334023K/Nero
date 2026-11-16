from abc import ABC, abstractmethod
from enum import Enum
from typing import Any, Dict, Optional, Tuple
from pydantic import BaseModel, Field


class PermissionLevel(str, Enum):
    AUTO = "auto"
    PERMISSION_REQUIRED = "permission_required"
    EXPLICIT_CONFIRMATION = "explicit_confirmation"


class ToolResult(BaseModel):
    success: bool
    action_taken: str
    output: Any = None
    error: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class BaseTool(ABC):
    """Abstract base class for all NERO automation tools."""

    name: str = ""
    description: str = ""
    permission_level: PermissionLevel = PermissionLevel.PERMISSION_REQUIRED
    parameters_schema: Dict[str, Any] = {}

    def validate_params(self, params: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        """Validate input parameters against requirements.

        Subclasses may override to provide detailed schema validation.
        """
        return True, None

    @abstractmethod
    async def execute(self, params: Dict[str, Any]) -> ToolResult:
        """Execute the tool action safely and return structured ToolResult."""
        pass

    def to_dict(self) -> Dict[str, Any]:
        """Serialize tool definition for API and client display."""
        return {
            "name": self.name,
            "description": self.description,
            "permission_level": self.permission_level.value,
            "parameters_schema": self.parameters_schema,
        }
