import asyncio
import re
from datetime import datetime, timezone
from typing import Any, AsyncGenerator

from app.intelligence.base import BaseAIProvider


class OfflineProvider(BaseAIProvider):
    """Built-in local offline rule/heuristic companion provider.
    Ensures NERO is always responsive even without API keys or internet connection.
    """

    def __init__(self, model_name: str = "nero-heuristic-v1") -> None:
        self._model_name = model_name

    @property
    def name(self) -> str:
        return "offline"

    @property
    def provider_type(self) -> str:
        return "local"

    @property
    def default_model(self) -> str:
        return self._model_name

    @property
    def is_configured(self) -> bool:
        return True

    async def check_health(self) -> bool:
        return True

    def _determine_response(
        self,
        prompt: str,
        system_prompt: str = "",
    ) -> str:
        text = prompt.strip().lower()
        now_str = datetime.now(timezone.utc).strftime("%A, %B %d, %Y at %H:%M UTC")

        # System time queries
        if any(w in text for w in ["what time", "current time", "what's the time", "today's date", "what date"]):
            return f"The current system time is {now_str}. All systems are operating normally."

        # Identity queries
        if any(w in text for w in ["who are you", "what is nero", "introduce yourself"]):
            return (
                "I am **NERO** — your neural desktop companion. I'm designed to assist you with tasks, "
                "manage your workflow, control system capabilities, and provide intelligent conversation. "
                "I'm currently running in autonomous offline mode."
            )

        # Capabilities / Help
        if any(w in text for w in ["help", "what can you do", "features", "commands"]):
            return (
                "Here is what I can do for you:\n\n"
                "• **Chat & Guidance**: Converse with me in 5 personality modes (Friend, Professional, Focus, Supportive, Adaptive).\n"
                "• **Offline Intelligence**: I work 100% offline or seamlessly with Gemini, OpenAI, and Ollama.\n"
                "• **System Control**: Time checks, status reports, and permission-managed actions.\n"
                "• **Streaming & Real-time**: Real-time response streaming and WebSocket telemetry.\n\n"
                "Feel free to ask questions, brainstorm, or configure additional AI providers in Settings!"
            )

        # Status
        if any(w in text for w in ["status", "system status", "health"]):
            return (
                f"**NERO System Status**:\n"
                f"• Core Engine: Active (Offline Companion)\n"
                f"• Timestamp: {now_str}\n"
                f"• Response Mode: Autonomous Heuristic\n"
                f"• Connectivity: Ready for cloud / local providers"
            )

        # Well-being / casual conversational check-in
        if re.search(r"\b(how are you|how're you|how are you doing|how is it going|how's it going|what's up|how do you feel)\b", text):
            if "friend" in system_prompt.lower():
                return "I'm doing great! Feeling energized and ready to tackle whatever comes our way. How are you doing today?"
            elif "focus" in system_prompt.lower():
                return "All core modules operational, low latency, focus mode locked in. What are we working on next?"
            elif "supportive" in system_prompt.lower():
                return "I'm doing wonderfully, thank you for asking! I'm right here with you. How is your day going so far?"
            return "I'm doing great! Systems fully operational, tuned to your frequency, and ready to help. How can I assist you?"

        # Greetings
        if re.search(r"\b(hello|hi|hey|greetings|good morning|good afternoon|good evening)\b", text):
            if "friend" in system_prompt.lower():
                return "Hey there! Great to see you. What are we diving into today?"
            elif "focus" in system_prompt.lower():
                return "Ready. State your task or focus objective."
            elif "professional" in system_prompt.lower():
                return "Good day. How may I assist your workflow today?"
            elif "supportive" in system_prompt.lower():
                return "Hello! I hope you're having a wonderful day. I'm right here with you — what can I help you with?"
            return "Hello! I am NERO, your desktop AI companion. How can I assist you right now?"

        # Thanks
        if re.search(r"\b(thanks|thank you|appreciate it)\b", text):
            if "friend" in system_prompt.lower():
                return "Anytime! Always here for you."
            return "You're very welcome! Let me know if you need anything else."

        # Code or technical request
        if any(w in text for w in ["code", "python", "javascript", "typescript", "function", "bug", "algorithm"]):
            return (
                f"Here is a structured approach to '{prompt[:60]}':\n\n"
                f"1. **Define requirements**: Clarify the inputs, outputs, and edge cases.\n"
                f"2. **Implementation**: Ensure clean types, error handling, and test coverage.\n"
                f"3. **Verification**: Run unit tests and benchmark if needed.\n\n"
                f"Connect an active Gemini or OpenAI provider in Settings for full autonomous code generation!"
            )

        # Default companion answer reflecting tone
        if "focus" in system_prompt.lower():
            return f"Understood: '{prompt}'. Focus maintained. Ready for next instruction."
        elif "friend" in system_prompt.lower():
            return (
                f"I hear you! Regarding '{prompt}', let's figure this out together. "
                "Even in offline mode, I'm here to bounce ideas with you."
            )
        elif "supportive" in system_prompt.lower():
            return (
                f"You're doing great. Taking on '{prompt}' is an important step. "
                "Take it one step at a time, and I'll support you throughout."
            )
        elif "professional" in system_prompt.lower():
            return (
                f"Acknowledged request: '{prompt}'. "
                "Proceeding with standard operational parameters. Awaiting specific directives."
            )

        # Adaptive / Default
        return (
            f"I have received your request: \"{prompt}\". "
            "NERO is operating smoothly. Connect a cloud AI key (Gemini, OpenAI) or start Ollama "
            "to unlock generative LLM capabilities!"
        )

    async def generate(
        self,
        prompt: str,
        history: list[dict[str, Any]] | None = None,
        system_prompt: str = "",
        **kwargs: Any,
    ) -> str:
        return self._determine_response(prompt, system_prompt)

    async def generate_stream(
        self,
        prompt: str,
        history: list[dict[str, Any]] | None = None,
        system_prompt: str = "",
        **kwargs: Any,
    ) -> AsyncGenerator[str, None]:
        full_text = self._determine_response(prompt, system_prompt)
        # Yield words in chunks to simulate realistic stream
        words = full_text.split(" ")
        for i, word in enumerate(words):
            chunk = word if i == len(words) - 1 else word + " "
            yield chunk
            # Yield quickly without blocking
            await asyncio.sleep(0.01)
