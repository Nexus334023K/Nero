import re
from typing import Any

from app.core.config import settings
from app.intelligence.personality.prompts import DEFAULT_MODE, PERSONALITY_MODES


class PersonalityEngine:
    """Manages active persona modes and dynamic system prompt generation."""

    def __init__(self, default_mode: str | None = None) -> None:
        initial = default_mode or settings.default_personality_mode or DEFAULT_MODE
        self._active_mode = initial.lower() if initial.lower() in PERSONALITY_MODES else DEFAULT_MODE

    def get_mode(self) -> str:
        return self._active_mode

    def set_mode(self, mode: str) -> bool:
        mode_key = mode.strip().lower()
        if mode_key in PERSONALITY_MODES:
            self._active_mode = mode_key
            return True
        return False

    def get_available_modes(self) -> list[dict[str, Any]]:
        return [
            {
                "id": key,
                "name": data["name"],
                "description": data["description"],
                "is_active": key == self._active_mode,
            }
            for key, data in PERSONALITY_MODES.items()
        ]

    def _analyze_adaptive_context(self, user_message: str) -> str:
        """Derives subtle stylistic guidance for adaptive mode based on user message cues."""
        text = user_message.lower().strip()
        additions = []

        # Technical/code request
        if any(w in text for w in ["code", "function", "error", "bug", "traceback", "sql", "typescript", "python"]):
            additions.append("The user has a technical or code objective. Provide clean, well-formatted solutions with explanations.")

        # Brief / Urgent
        if len(text.split()) <= 4 and ("quick" in text or "fast" in text or text.endswith("?")):
            additions.append("Keep the response concise and immediately actionable.")

        # Casual greeting / friendly
        if re.search(r"\b(hello|hi|hey|howdy|what's up|sup)\b", text):
            additions.append("Engage with a warm and conversational opening.")

        # Frustration or fatigue
        if any(w in text for w in ["tired", "stuck", "frustrated", "hard", "ugh", "can't figure"]):
            additions.append("The user may be feeling strained. Offer encouraging reassurance alongside the solution.")

        return (" " + " ".join(additions)) if additions else ""

    def build_system_prompt(
        self,
        mode: str | None = None,
        context: dict[str, Any] | None = None,
        user_message: str = "",
    ) -> str:
        selected_mode = (mode or self._active_mode).strip().lower()
        mode_info = PERSONALITY_MODES.get(selected_mode, PERSONALITY_MODES[DEFAULT_MODE])
        base_prompt = mode_info["prompt"]

        extras: list[str] = []

        # Include adaptive dynamic tuning
        if selected_mode == "adaptive" and user_message:
            adaptive_guidance = self._analyze_adaptive_context(user_message)
            if adaptive_guidance:
                extras.append(f"\nContextual calibration:{adaptive_guidance}")

        # Include additional caller context if provided
        if context:
            context_str = ", ".join(f"{k}: {v}" for k, v in context.items())
            extras.append(f"\nActive Context: [{context_str}]")

        return base_prompt + "".join(extras)


personality_engine = PersonalityEngine()
