import io
import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.voice.tts.fish_audio_provider import FishAudioTTSProvider
from app.voice.tts.mock_provider import MockTTSProvider
from app.voice.wakeword.detector import WakeWordDetector


@pytest.mark.asyncio
async def test_mock_tts_provider():
    provider = MockTTSProvider()
    assert provider.name == "mock"
    assert provider.is_configured is True
    assert provider.mime_type == "audio/wav"

    audio = await provider.synthesize("Hello from NERO voice test", speed=1.0)
    assert len(audio) > 44
    assert audio[:4] == b"RIFF"  # Valid WAV header

    chunks = []
    async for chunk in provider.synthesize_stream("Streaming audio"):
        chunks.append(chunk)
    assert len(chunks) > 0
    assert b"".join(chunks)[:4] == b"RIFF"


@pytest.mark.asyncio
async def test_fish_audio_provider():
    # Test unconfigured Fish Audio has graceful fallback
    provider = FishAudioTTSProvider(api_key="", default_reference_id="ref_123")
    assert provider.name == "fish_audio"
    assert provider.is_configured is False

    # Should fallback cleanly to generating playable audio without crashing
    audio = await provider.synthesize("Testing fish audio fallback")
    assert len(audio) > 44

    # Test configured provider properties
    configured = FishAudioTTSProvider(api_key="test_fish_key_12345", default_reference_id="ref_abc")
    assert configured.is_configured is True
    assert configured.mime_type == "audio/mpeg"


def test_wakeword_detector():
    detector = WakeWordDetector(target_word="nero")
    assert detector.process_text("Hey Nero what is the time?") is True
    assert detector.process_text("Nero, open calculator") is True
    assert detector.process_text("What is the weather today?") is False


@pytest.mark.asyncio
async def test_voice_api_endpoints():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        # 1. Test TTS endpoint
        tts_res = await client.post(
            "/api/voice/tts",
            json={"text": "Hello, testing NERO speech", "provider": "mock", "speed": 1.0},
        )
        assert tts_res.status_code == 200
        assert len(tts_res.content) > 44
        assert tts_res.headers["content-type"].startswith("audio/")

        # 2. Test STT endpoint with dummy WAV file
        dummy_wav = b"RIFF" + b"\x00" * 50
        files = {"file": ("test.wav", io.BytesIO(dummy_wav), "audio/wav")}
        stt_res = await client.post("/api/voice/stt", files=files)
        assert stt_res.status_code == 200
        stt_data = stt_res.json()
        assert "text" in stt_data
        assert "confidence" in stt_data

        # 3. Test Voices list endpoint (verify Fish Audio is included)
        voices_res = await client.get("/api/voice/voices")
        assert voices_res.status_code == 200
        voices = voices_res.json()["voices"]
        assert any(v["provider"] == "fish_audio" for v in voices)
        assert any(v["provider"] == "piper" for v in voices)

        # 4. Test Voice Settings GET & POST
        settings_res = await client.get("/api/voice/settings")
        assert settings_res.status_code == 200
        current_settings = settings_res.json()
        assert "tts_provider" in current_settings

        update_res = await client.post(
            "/api/voice/settings",
            json={
                "tts_provider": "fish_audio",
                "stt_provider": "whisper",
                "wake_word_enabled": True,
                "wake_word": "nero",
                "fish_audio_api_key": "fish_key_xyz",
                "fish_audio_reference_id": "custom_voice_789",
                "speed": 1.1,
            },
        )
        assert update_res.status_code == 200
        updated_data = update_res.json()
        assert updated_data["tts_provider"] == "fish_audio"
        assert updated_data["fish_audio_api_key"] == "fish_key_xyz"

        # 5. Test Wakeword check endpoint
        wake_res = await client.post(
            "/api/voice/wakeword/check",
            json={"text": "Hey Nero play some music"},
        )
        assert wake_res.status_code == 200
        assert wake_res.json()["detected"] is True
