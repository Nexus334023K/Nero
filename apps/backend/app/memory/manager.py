import json
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy import delete, desc, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging_config import get_logger
from app.database.models import Memory
from app.database.session import AsyncSessionLocal
from app.memory.extractor import MemoryCandidate, MemoryCandidateExtractor, MemoryPrivacyGuard
from app.memory.vector_store import ChromaVectorStore

logger = get_logger(__name__)


class MemoryManager:
    """Orchestrates SQLite persistent memory records and ChromaDB vector search."""

    def __init__(self, vector_store: Optional[ChromaVectorStore] = None):
        self.vector_store = vector_store or ChromaVectorStore()
        self.is_enabled = True

    async def add_memory(
        self,
        content: str,
        user_id: str = "00000000-0000-0000-0000-000000000001",
        memory_type: str = "long_term",
        importance: float = 0.5,
        tags: Optional[List[str]] = None,
    ) -> Optional[Dict[str, Any]]:
        """Add a memory to SQLite and index into ChromaDB."""
        if not self.is_enabled:
            return None

        # Privacy guard check
        if MemoryPrivacyGuard.contains_sensitive_info(content):
            logger.warning("Rejected memory containing sensitive information.")
            return None

        mem_id = str(uuid.uuid4())
        tag_list = tags or []
        tag_json = json.dumps(tag_list)
        now = datetime.now(timezone.utc)

        # 1. Save to SQLite
        async with AsyncSessionLocal() as session:
            memory_obj = Memory(
                id=mem_id,
                user_id=user_id,
                content=content.strip(),
                importance=importance,
                memory_type=memory_type,
                tags=tag_json,
                created_at=now,
                accessed_at=now,
            )
            session.add(memory_obj)
            await session.commit()

        # 2. Index in ChromaDB
        self.vector_store.add(
            memory_id=mem_id,
            content=content.strip(),
            metadata={
                "user_id": user_id,
                "memory_type": memory_type,
                "importance": importance,
                "tags": ",".join(tag_list),
            },
        )

        return {
            "id": mem_id,
            "user_id": user_id,
            "content": content.strip(),
            "importance": importance,
            "memory_type": memory_type,
            "tags": tag_list,
            "created_at": now.isoformat(),
        }

    async def list_memories(
        self,
        user_id: str = "00000000-0000-0000-0000-000000000001",
        memory_type: Optional[str] = None,
        search_query: Optional[str] = None,
        limit: int = 50,
    ) -> List[Dict[str, Any]]:
        """Retrieve memories from SQLite with optional filtering."""
        async with AsyncSessionLocal() as session:
            query = select(Memory).where(Memory.user_id == user_id)
            if memory_type:
                query = query.where(Memory.memory_type == memory_type)
            if search_query:
                query = query.where(Memory.content.like(f"%{search_query}%"))

            query = query.order_by(desc(Memory.importance), desc(Memory.created_at)).limit(limit)
            result = await session.execute(query)
            memories = result.scalars().all()

            results = []
            for m in memories:
                try:
                    parsed_tags = json.loads(m.tags) if m.tags else []
                except Exception:
                    parsed_tags = []

                results.append(
                    {
                        "id": m.id,
                        "content": m.content,
                        "importance": m.importance,
                        "memory_type": m.memory_type,
                        "tags": parsed_tags,
                        "created_at": m.created_at.isoformat() if m.created_at else None,
                        "accessed_at": m.accessed_at.isoformat() if m.accessed_at else None,
                    }
                )
            return results

    async def semantic_search(
        self,
        query: str,
        user_id: str = "00000000-0000-0000-0000-000000000001",
        limit: int = 5,
        memory_type: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Perform semantic search via ChromaDB and update accessed_at in SQLite."""
        if not self.is_enabled:
            return []

        vector_results = self.vector_store.query(
            query_text=query,
            limit=limit,
            memory_type=memory_type,
        )

        if not vector_results:
            return []

        # Update accessed_at in SQLite
        now = datetime.now(timezone.utc)
        ids = [res["id"] for res in vector_results]
        async with AsyncSessionLocal() as session:
            await session.execute(
                update(Memory).where(Memory.id.in_(ids)).values(accessed_at=now)
            )
            await session.commit()

        return vector_results

    async def delete_memory(self, memory_id: str) -> bool:
        """Delete from SQLite and ChromaDB."""
        async with AsyncSessionLocal() as session:
            await session.execute(delete(Memory).where(Memory.id == memory_id))
            await session.commit()

        self.vector_store.delete(memory_id)
        return True

    async def clear_all(self, user_id: str = "00000000-0000-0000-0000-000000000001") -> bool:
        """Purge all user memories."""
        async with AsyncSessionLocal() as session:
            await session.execute(delete(Memory).where(Memory.user_id == user_id))
            await session.commit()

        self.vector_store.clear()
        return True

    async def process_chat_message_for_memories(
        self,
        user_text: str,
        user_id: str = "00000000-0000-0000-0000-000000000001",
    ) -> List[Dict[str, Any]]:
        """Automatically detect memory candidates and store them."""
        candidates = MemoryCandidateExtractor.extract_candidates(user_text)
        saved = []
        for cand in candidates:
            # Check if similar memory already exists
            existing = await self.semantic_search(cand.content, user_id=user_id, limit=1)
            if existing and existing[0].get("score", 0) > 0.85:
                continue

            res = await self.add_memory(
                content=cand.content,
                user_id=user_id,
                memory_type=cand.memory_type,
                importance=cand.importance,
                tags=cand.tags,
            )
            if res:
                saved.append(res)
        return saved


memory_manager = MemoryManager()
