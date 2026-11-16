import re
from typing import List, Optional, Tuple
from pydantic import BaseModel, Field

from app.core.logging_config import get_logger

logger = get_logger(__name__)


class MemoryCandidate(BaseModel):
    content: str
    memory_type: str = "long_term"  # "long_term" | "episodic"
    importance: float = Field(default=0.5, ge=0.0, le=1.0)
    tags: List[str] = Field(default_factory=list)


class MemoryPrivacyGuard:
    """Detects and rejects passwords, API keys, credentials, and sensitive private tokens."""

    SENSITIVE_PATTERNS = [
        # Passwords / secrets
        re.compile(r"(?:password|passwd|secret|pwd)\s*(?:is|[:=])\s*\S+", re.IGNORECASE),
        # OpenAI keys
        re.compile(r"sk-[a-zA-Z0-9_\-]{20,}", re.IGNORECASE),
        # Google API keys
        re.compile(r"AIza[0-9A-Za-z-_]{35}"),
        # GitHub tokens
        re.compile(r"gh[pousr]_[a-zA-Z0-9]{36}"),
        # Generic bearer tokens / private keys
        re.compile(r"(?:bearer\s+[a-zA-Z0-9_\-\.]{20,})", re.IGNORECASE),
        re.compile(r"-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----"),
        # Credit cards
        re.compile(r"\b(?:\d{4}[ -]?){3}\d{4}\b"),
    ]

    @classmethod
    def contains_sensitive_info(cls, text: str) -> bool:
        """Check if text contains any credential, token, or password pattern."""
        for pattern in cls.SENSITIVE_PATTERNS:
            if pattern.search(text):
                return True
        return False

    @classmethod
    def sanitize(cls, text: str) -> str:
        """Mask any accidental sensitive token pattern with [REDACTED]."""
        sanitized = text
        for pattern in cls.SENSITIVE_PATTERNS:
            sanitized = pattern.sub("[REDACTED_CREDENTIAL]", sanitized)
        return sanitized


class MemoryCandidateExtractor:
    """Analyzes user conversations to identify durable facts, preferences, and episodic memories."""

    PREFERENCE_INDICATORS = [
        (re.compile(r"\b(?:my name is|call me|i am|i'm)\s+([A-Za-z0-9_\-\s]{2,30})", re.IGNORECASE), "user_identity", 0.9),
        (re.compile(r"\b(?:i prefer|i like|i love|my favorite|i want)\s+([^.!?\n]{3,80})", re.IGNORECASE), "preference", 0.75),
        (re.compile(r"\b(?:i work on|i am building|my project is|we use)\s+([^.!?\n]{3,80})", re.IGNORECASE), "project_context", 0.8),
        (re.compile(r"\b(?:remember that|don't forget|keep in mind)\s+([^.!?\n]{3,100})", re.IGNORECASE), "explicit_memory", 0.95),
        (re.compile(r"\b(?:always|never)\s+([^.!?\n]{3,80})", re.IGNORECASE), "rule_preference", 0.85),
    ]

    @classmethod
    def extract_candidates(cls, user_text: str) -> List[MemoryCandidate]:
        """Extract memory candidates from user input."""
        candidates: List[MemoryCandidate] = []

        # 1. Privacy Check
        if MemoryPrivacyGuard.contains_sensitive_info(user_text):
            logger.info("Memory extraction skipped: sensitive credential pattern detected.")
            return []

        clean_text = user_text.strip()
        if len(clean_text) < 6:
            return []

        # 2. Pattern Matching
        for pattern, tag, importance in cls.PREFERENCE_INDICATORS:
            match = pattern.search(clean_text)
            if match:
                # Capture either whole sentence or matched phrase
                content = clean_text
                candidates.append(
                    MemoryCandidate(
                        content=content,
                        memory_type="long_term",
                        importance=importance,
                        tags=[tag],
                    )
                )
                break

        # 3. Explicit task completion memory
        if re.search(r"\b(?:completed|finished|shipped|deployed)\s+(.+)", clean_text, re.IGNORECASE):
            candidates.append(
                MemoryCandidate(
                    content=clean_text,
                    memory_type="episodic",
                    importance=0.65,
                    tags=["task_milestone"],
                )
            )

        return candidates
