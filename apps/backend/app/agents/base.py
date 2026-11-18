from abc import ABC, abstractmethod
from enum import Enum
from typing import Any, Dict, List, Optional, Set
from pydantic import BaseModel, Field


class AgentCapability(str, Enum):
    WEB_SEARCH = "web_search"
    WEB_READ = "web_read"
    FILE_READ = "file_read"
    FILE_WRITE = "file_write"
    GIT_ANALYSIS = "git_analysis"
    SYSTEM_MONITOR = "system_monitor"
    
    # Dangerous capabilities (strictly forbidden for background agents)
    SHELL_EXEC = "shell_exec"
    FILE_DELETE = "file_delete"
    EXTERNAL_MESSAGING = "external_messaging"
    FINANCIAL_TRANSACTIONS = "financial_transactions"
    SYSTEM_POWER = "system_power"


DANGEROUS_CAPABILITIES: Set[AgentCapability] = {
    AgentCapability.SHELL_EXEC,
    AgentCapability.FILE_DELETE,
    AgentCapability.EXTERNAL_MESSAGING,
    AgentCapability.FINANCIAL_TRANSACTIONS,
    AgentCapability.SYSTEM_POWER,
}


class AgentDefinition(BaseModel):
    name: str
    display_name: str
    description: str
    allowed_capabilities: Set[AgentCapability]
    allowed_tools: List[str] = Field(default_factory=list)


class BaseAgent(ABC):
    """Abstract base class for all background agents."""

    def __init__(self, definition: AgentDefinition):
        self.definition = definition

    @property
    def name(self) -> str:
        return self.definition.name

    @property
    def allowed_capabilities(self) -> Set[AgentCapability]:
        return self.definition.allowed_capabilities

    def can_use_capability(self, capability: AgentCapability) -> bool:
        if capability in DANGEROUS_CAPABILITIES:
            return False
        return capability in self.allowed_capabilities

    def is_tool_allowed(self, tool_name: str) -> bool:
        return tool_name in self.definition.allowed_tools

    @abstractmethod
    async def plan(self, request: str, context: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """Generate a structured sequential step plan for the given request."""
        pass

    @abstractmethod
    async def execute_step(
        self,
        task_id: str,
        step_number: int,
        step_info: Dict[str, Any],
        accumulated_context: Dict[str, Any],
        steering_instructions: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """Execute a single step of the plan and return updated context and results."""
        pass
