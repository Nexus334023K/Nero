import pytest
from httpx import ASGITransport, AsyncClient

from app.database.init_db import init_database
from app.main import app
from app.memory.extractor import MemoryCandidateExtractor, MemoryPrivacyGuard
from app.memory.manager import memory_manager
from app.memory.vector_store import ChromaVectorStore


def test_privacy_guard():
    # Passwords and API keys must be detected and rejected
    assert MemoryPrivacyGuard.contains_sensitive_info("my password is secret12345") is True
    assert MemoryPrivacyGuard.contains_sensitive_info("sk-proj1234567890abcdefghijklmnop") is True
    assert MemoryPrivacyGuard.contains_sensitive_info("AIzaSyD12345678901234567890123456789012") is True
    assert MemoryPrivacyGuard.contains_sensitive_info("I prefer dark mode in VS Code") is False

    # Redaction
    sanitized = MemoryPrivacyGuard.sanitize("password: mySuperSecretPassword123")
    assert "[REDACTED_CREDENTIAL]" in sanitized


def test_candidate_extraction():
    candidates = MemoryCandidateExtractor.extract_candidates("My name is Nexus and I prefer Python.")
    assert len(candidates) > 0
    assert any("Nexus" in c.content for c in candidates)
    assert candidates[0].memory_type == "long_term"
    assert candidates[0].importance >= 0.7

    # Sensitive strings must yield zero candidates
    sensitive = MemoryCandidateExtractor.extract_candidates("My password is secretPass123!")
    assert len(sensitive) == 0


@pytest.mark.asyncio
async def test_vector_store():
    store = ChromaVectorStore(persist_dir="./test_chroma_db")
    store.add("mem_1", "User loves electric cyan and obsidian black theme", {"memory_type": "long_term"})
    store.add("mem_2", "User is building NERO personal desktop companion", {"memory_type": "long_term"})

    results = store.query("cyan theme", limit=2)
    assert len(results) > 0
    assert "cyan" in results[0]["content"].lower()

    store.delete("mem_1")
    store.clear()


@pytest.mark.asyncio
async def test_memory_api_endpoints():
    await init_database()
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        # 1. Add a memory
        add_res = await client.post(
            "/api/memory",
            json={
                "content": "User prefers dark mode and concise responses",
                "memory_type": "long_term",
                "importance": 0.85,
                "tags": ["ui_preference", "style"],
            },
        )
        assert add_res.status_code == 200
        mem_data = add_res.json()
        assert "id" in mem_data
        mem_id = mem_data["id"]
        assert mem_data["content"] == "User prefers dark mode and concise responses"

        # 2. Rejection of sensitive token
        bad_res = await client.post(
            "/api/memory",
            json={"content": "password=MySecretPassword123", "memory_type": "long_term"},
        )
        assert bad_res.status_code == 400

        # 3. List memories
        list_res = await client.get("/api/memory")
        assert list_res.status_code == 200
        mem_list = list_res.json()["memories"]
        assert any(m["id"] == mem_id for m in mem_list)

        # 4. Semantic search endpoint
        search_res = await client.post(
            "/api/memory/search",
            json={"query": "dark mode preference", "limit": 3},
        )
        assert search_res.status_code == 200
        search_results = search_res.json()["results"]
        assert len(search_results) > 0
        assert any("dark mode" in r["content"] for r in search_results)

        # 5. Memory stats endpoint
        stats_res = await client.get("/api/memory/stats")
        assert stats_res.status_code == 200
        stats = stats_res.json()
        assert stats["total_memories"] >= 1
        assert stats["memory_enabled"] is True

        # 6. Delete memory
        del_res = await client.delete(f"/api/memory/{mem_id}")
        assert del_res.status_code == 200
        assert del_res.json()["success"] is True
