class WakeWordDetector:
    """Wake-word detector pipeline for hands-free activation."""

    def __init__(self, target_word: str = "nero", sensitivity: float = 0.5):
        self.target_word = target_word.lower()
        self.sensitivity = sensitivity
        self.is_active = False

    def process_text(self, text: str) -> bool:
        """Simple text-stream detection for wakeword triggering."""
        lowered = text.lower()
        return self.target_word in lowered or "hey nero" in lowered

    def set_sensitivity(self, sensitivity: float) -> None:
        self.sensitivity = max(0.1, min(1.0, sensitivity))
