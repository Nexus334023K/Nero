import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.mark.asyncio
async def test_health_endpoint():
    """GET /api/health returns 200 with status='healthy'."""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "version" in data
    assert "uptime_seconds" in data


@pytest.mark.asyncio
async def test_ping_endpoint():
    """GET /api/health/ping returns 200."""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get("/api/health/ping")
    assert response.status_code == 200
    data = response.json()
    assert data["pong"] is True
    assert "timestamp" in data


@pytest.mark.asyncio
async def test_websocket():
    """WebSocket connects and responds to ping with pong."""
    from starlette.testclient import TestClient

    client = TestClient(app)
    with client.websocket_connect("/ws") as ws:
        import json

        ws.send_text(json.dumps({"type": "ping"}))
        data = json.loads(ws.receive_text())
        assert data["type"] == "pong"
        assert "timestamp" in data
