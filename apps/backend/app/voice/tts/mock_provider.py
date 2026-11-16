import io
import math
import struct
import wave
from typing import AsyncGenerator, Optional

from app.voice.tts.base import BaseTTSProvider


class MockTTSProvider(BaseTTSProvider):
    """Generates synthetic spoken beep/chime audio waveform in valid playable WAV format."""

    @property
    def name(self) -> str:
        return "mock"

    @property
    def is_configured(self) -> bool:
        return True

    @property
    def mime_type(self) -> str:
        return "audio/wav"

    def _generate_wav(self, text: str, speed: float = 1.0) -> bytes:
        sample_rate = 22050
        # Calculate duration based on words (roughly 0.2s per word, adjusted by speed)
        word_count = max(len(text.split()), 1)
        duration = min(max(word_count * 0.2 / speed, 0.5), 6.0)
        num_samples = int(sample_rate * duration)

        buffer = io.BytesIO()
        with wave.open(buffer, "wb") as wav_file:
            wav_file.setnchannels(1)  # Mono
            wav_file.setsampwidth(2)  # 16-bit
            wav_file.setframerate(sample_rate)

            # Generate pleasant gentle melodic harmonic tone representing speech
            base_freq = 320.0
            samples = bytearray()
            for i in range(num_samples):
                t = i / sample_rate
                # Frequency modulation to simulate human speech cadence
                freq = base_freq + 60.0 * math.sin(2 * math.pi * 3.5 * t)
                envelope = math.sin(math.pi * (i / num_samples)) ** 0.5
                val = int(envelope * 8000.0 * math.sin(2 * math.pi * freq * t))
                samples.extend(struct.pack("<h", max(-32767, min(32767, val))))

            wav_file.writeframes(bytes(samples))

        return buffer.getvalue()

    async def synthesize(
        self,
        text: str,
        voice_id: Optional[str] = None,
        speed: float = 1.0,
    ) -> bytes:
        return self._generate_wav(text, speed)

    async def synthesize_stream(
        self,
        text: str,
        voice_id: Optional[str] = None,
        speed: float = 1.0,
    ) -> AsyncGenerator[bytes, None]:
        audio = self._generate_wav(text, speed)
        chunk_size = 4096
        for i in range(0, len(audio), chunk_size):
            yield audio[i : i + chunk_size]

    async def check_health(self) -> bool:
        return True
