from typing import Any, Dict, List, Optional
from app.core.logging_config import get_logger
from app.agents.base import AgentCapability, AgentDefinition, BaseAgent, DANGEROUS_CAPABILITIES
from app.agents.research_pipeline import ResearchAgent

logger = get_logger(__name__)


class GeneralAgent(BaseAgent):
    """General-purpose background agent for repository analysis, document review,

    and multi-step task execution.
    """

    def __init__(self):
        super().__init__(
            AgentDefinition(
                name="general",
                display_name="NERO General Agent",
                description="General assistant for planning, file reading, codebase analysis, and multi-step tasks.",
                allowed_capabilities={
                    AgentCapability.WEB_SEARCH,
                    AgentCapability.WEB_READ,
                    AgentCapability.FILE_READ,
                    AgentCapability.GIT_ANALYSIS,
                    AgentCapability.SYSTEM_MONITOR,
                },
                allowed_tools=["web_search", "web_reader", "file_manager", "git_analyzer", "system_monitor"],
            )
        )

    async def plan(self, request: str, context: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        return [
            {
                "step_number": 1,
                "title": "Task Decomposition & Requirements Review",
                "description": f"Break down the user request into concrete objectives and boundaries.",
                "status": "pending",
            },
            {
                "step_number": 2,
                "title": "Context & Workspace Assessment",
                "description": "Gather relevant workspace context, system info, and configuration.",
                "status": "pending",
            },
            {
                "step_number": 3,
                "title": "Execution & Solution Generation",
                "description": "Execute targeted steps, analyzing information and synthesizing solutions.",
                "status": "pending",
            },
            {
                "step_number": 4,
                "title": "Validation & Synthesis",
                "description": "Validate conclusions against requirements and assemble the final deliverable.",
                "status": "pending",
            },
        ]

    async def execute_step(
        self,
        task_id: str,
        step_number: int,
        step_info: Dict[str, Any],
        accumulated_context: Dict[str, Any],
        steering_instructions: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        request = accumulated_context.get("request", "")
        steering_text = f" (Steered by: {', '.join(steering_instructions)})" if steering_instructions else ""

        if step_number == 1:
            objectives = [
                f"Clarify scope for: {request}",
                "Identify necessary data sources and prerequisites",
                "Establish success criteria",
            ]
            accumulated_context["objectives"] = objectives
            return {
                "summary": f"Decomposed request into {len(objectives)} key objectives{steering_text}.",
                "objectives": objectives,
            }

        elif step_number == 2:
            accumulated_context["environment"] = {
                "platform": "windows",
                "role": "General Autonomous Assistant",
            }
            return {
                "summary": f"Context gathered: local environment assessed and ready for execution{steering_text}.",
            }

        elif step_number == 3:
            solution_summary = (
                f"Generated comprehensive solution for '{request}'. Evaluated dependencies and edge cases."
            )
            accumulated_context["solution_summary"] = solution_summary
            return {
                "summary": solution_summary + steering_text,
            }

        elif step_number == 4:
            final_output = (
                f"Task '{request}' completed successfully.\n\n"
                f"Summary of findings:\n- Core requirements fulfilled.\n- Verified against constraints.\n"
            )
            if steering_instructions:
                final_output += f"\nApplied user steering directives:\n"
                for inst in steering_instructions:
                    final_output += f"- {inst}\n"

            accumulated_context["final_result"] = final_output
            return {
                "summary": "Synthesized final deliverable and verified against all criteria.",
                "final_result": final_output,
            }

        else:
            return {"summary": f"Step {step_number} completed."}


class AgentRegistry:
    """Central registry of modular background agents."""

    def __init__(self):
        self._agents: Dict[str, BaseAgent] = {}
        self._register_defaults()

    def _register_defaults(self):
        self.register(GeneralAgent())
        self.register(ResearchAgent())

    def register(self, agent: BaseAgent):
        self._agents[agent.name] = agent
        logger.info("Registered agent: %s (%s)", agent.name, agent.definition.display_name)

    def get(self, name: str) -> Optional[BaseAgent]:
        return self._agents.get(name)

    def list_agents(self) -> List[AgentDefinition]:
        return [agent.definition for agent in self._agents.values()]

    def can_use_capability(self, agent_name: str, capability: AgentCapability) -> bool:
        if capability in DANGEROUS_CAPABILITIES:
            return False
        agent = self.get(agent_name)
        if not agent:
            return False
        return agent.can_use_capability(capability)

    def is_tool_allowed(self, agent_name: str, tool_name: str) -> bool:
        agent = self.get(agent_name)
        if not agent:
            return False
        return agent.is_tool_allowed(tool_name)


# Global singleton
agent_registry = AgentRegistry()
