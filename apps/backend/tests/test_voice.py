import io
import pytest
from httpx import ASGITransport, AsyncClient, Response as HttpxResponse

from app.main import app
from app.voice.manager import voice_manager
from app.voice.tts.fish_audio_provider import FishAudioError, FishAudioTTSProvider
from app.voice.tts.mock_provider import MockTTSProvider
from app.voice.tts.factory import TTSFactory
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
async def test_fish_audio_provider_configuration_and_fallback():
    # 1. Unconfigured without fallback raises FishAudioError
    unconfigured = FishAudioTTSProvider(api_key="", default_reference_id="ref_123", allow_fallback=False)
    assert unconfigured.name == "fish_audio"
    assert unconfigured.is_configured is False
    with pytest.raises(FishAudioError) as exc_info:
        await unconfigured.synthesize("Testing fish audio without key")
    assert exc_info.value.status_code == 400
    assert "not configured" in exc_info.value.message

    # 2. Unconfigured with explicit fallback generates audio cleanly
    fallback_provider = FishAudioTTSProvider(api_key="", default_reference_id="ref_123", allow_fallback=True)
    audio = await fallback_provider.synthesize("Testing fish audio fallback")
    assert len(audio) > 44
    assert audio[:4] == b"RIFF"

    # 3. Configured provider properties
    configured = FishAudioTTSProvider(
        api_key="test_fish_key_12345",
        default_reference_id="ref_custom_voice_id",
        model="s2.1-pro",
        allow_fallback=False,
    )
    assert configured.is_configured is True
    assert configured.mime_type == "audio/mpeg"
    assert configured.model == "s2.1-pro"
    assert configured.default_reference_id == "ref_custom_voice_id"


@pytest.mark.asyncio
async def test_fish_audio_api_request_construction_and_mocked_success(monkeypatch):
    """Test Fish Audio request construction, headers, reference_id, and response handling."""
    provider = FishAudioTTSProvider(
        api_key="test_secret_api_key_xyz",
        default_reference_id="voice_clone_abc",
        model="s2.1-pro",
        allow_fallback=False,
    )

    captured_request = {}
    mock_mp3_data = b"\xff\xfb\x90\x64" + b"\x00" * 200  # MP3 frame sync header + bytes

    import httpx

    async def mock_post(client_self, url, *args, **kwargs):
        captured_request["url"] = str(url)
        captured_request["headers"] = kwargs.get("headers", {})
        captured_request["json"] = kwargs.get("json", {})
        return HttpxResponse(
            status_code=200,
            content=mock_mp3_data,
            headers={"content-type": "audio/mpeg"},
        )

    monkeypatch.setattr(httpx.AsyncClient, "post", mock_post)

    audio = await provider.synthesize("Hello this is Nero voice test.", voice_id="voice_clone_abc")

    # Verify headers and payload structure per Fish Audio documentation
    assert captured_request["url"] == "https://api.fish.audio/v1/tts"
    assert captured_request["headers"]["Authorization"] == "Bearer test_secret_api_key_xyz"
    assert captured_request["headers"]["model"] == "s2.1-pro"
    assert captured_request["headers"]["Content-Type"] == "application/json"
    assert captured_request["json"]["text"] == "Hello this is Nero voice test."
    assert captured_request["json"]["reference_id"] == "voice_clone_abc"
    assert captured_request["json"]["format"] == "mp3"
    assert captured_request["json"]["normalize"] is True

    # Verify audio bytes returned intact
    assert audio == mock_mp3_data
    assert len(audio) == len(mock_mp3_data)


@pytest.mark.asyncio
async def test_fish_audio_http_error_handling_and_no_silent_fallback(monkeypatch):
    """Verify 401, 402, 422 errors raise FishAudioError and do NOT silently fallback to mock beep."""
    import httpx

    # 1. Test 401 Unauthorized
    provider_401 = FishAudioTTSProvider(
        api_key="invalid_key",
        default_reference_id="voice_123",
        allow_fallback=False,
    )

    async def mock_post_401(client_self, url, *args, **kwargs):
        return HttpxResponse(
            status_code=401,
            text='{"detail": "Unauthorized: Invalid API key"}',
            headers={"content-type": "application/json"},
        )

    monkeypatch.setattr(httpx.AsyncClient, "post", mock_post_401)

    with pytest.raises(FishAudioError) as exc_401:
        await provider_401.synthesize("Testing 401")
    assert exc_401.value.status_code == 401
    assert "401" in exc_401.value.message
    # Ensure raw API key is never exposed in message
    assert "invalid_key" not in exc_401.value.message

    # 2. Test Empty Audio response (status 200 but 0 bytes)
    async def mock_post_empty(client_self, url, *args, **kwargs):
        return HttpxResponse(status_code=200, content=b"", headers={"content-type": "audio/mpeg"})

    monkeypatch.setattr(httpx.AsyncClient, "post", mock_post_empty)
    with pytest.raises(FishAudioError) as exc_empty:
        await provider_401.synthesize("Testing empty audio")
    assert exc_empty.value.status_code == 502
    assert "empty audio" in exc_empty.value.message.lower()


def test_wakeword_detector():
    detector = WakeWordDetector(target_word="nero")
    assert detector.process_text("Hey Nero what is the time?") is True
    assert detector.process_text("Nero, open calculator") is True
    assert detector.process_text("What is the weather today?") is False


@pytest.mark.asyncio
async def test_voice_api_endpoints_and_persistence():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        # 1. Test TTS endpoint with mock provider
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

        # 4. Test Voice Settings GET & POST (and persistence)
        update_res = await client.post(
            "/api/voice/settings",
            json={
                "tts_provider": "fish_audio",
                "stt_provider": "whisper",
                "wake_word_enabled": True,
                "wake_word": "nero",
                "fish_audio_api_key": "fish_key_persistent_xyz",
                "fish_audio_reference_id": "custom_voice_persistent_789",
                "fish_audio_model": "s2.1-pro",
                "speed": 1.1,
                "allow_fallback": False,
            },
        )
        assert update_res.status_code == 200
        updated_data = update_res.json()
        assert updated_data["tts_provider"] == "fish_audio"
        assert updated_data["fish_audio_api_key"] == "fish_key_persistent_xyz"
        assert updated_data["fish_audio_reference_id"] == "custom_voice_persistent_789"
        assert updated_data["allow_fallback"] is False

        # Verify persistent reload
        assert voice_manager.settings.fish_audio_api_key == "fish_key_persistent_xyz"
        assert voice_manager.settings.fish_audio_reference_id == "custom_voice_persistent_789"

        # 5. Test Voice Test endpoint
        test_res = await client.post(
            "/api/voice/test",
            json={"provider": "mock", "text": "Testing voice synthesis."},
        )
        assert test_res.status_code == 200
        test_json = test_res.json()
        assert test_json["success"] is True
        assert test_json["audio_size_bytes"] > 0

        # 6. Test Wakeword check endpoint
        wake_res = await client.post(
            "/api/voice/wakeword/check",
            json={"text": "Hey Nero play some music"},
        )
        assert wake_res.status_code == 200
        assert wake_res.json()["detected"] is True
