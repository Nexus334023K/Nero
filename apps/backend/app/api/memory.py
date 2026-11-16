from typing import List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.core.logging_config import get_logger
from app.memory.manager import memory_manager

logger = get_logger(__name__)

router = APIRouter(prefix="/memory", tags=["memory"])


class AddMemoryRequest(BaseModel):
    content: str
    memory_type: str = "long_term"  # "long_term" | "episodic"
    importance: float = Field(default=0.5, ge=0.0, le=1.0)
    tags: Optional[List[str]] = None


class SearchMemoryRequest(BaseModel):
    query: str
    limit: int = 5
    memory_type: Optional[str] = None


@router.get("")
async def list_memories(
    memory_type: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 50,
):
    """List stored memories with optional search and type filters."""
    memories = await memory_manager.list_memories(
        memory_type=memory_type,
        search_query=search,
        limit=limit,
    )
    return {"memories": memories, "count": len(memories)}


@router.post("")
async def create_memory(req: AddMemoryRequest):
    """Explicitly create and index a new memory."""
    if not req.content.strip():
        raise HTTPException(status_code=400, detail="Memory content cannot be empty")

    res = await memory_manager.add_memory(
        content=req.content,
        memory_type=req.memory_type,
        importance=req.importance,
        tags=req.tags,
    )

    if res is None:
        raise HTTPException(
            status_code=400,
            detail="Memory could not be saved (blocked by privacy guard or memory disabled)",
        )

    return res


@router.delete("/{memory_id}")
async def delete_memory(memory_id: str):
    """Delete a specific memory by ID."""
    success = await memory_manager.delete_memory(memory_id)
    return {"success": success, "id": memory_id}


@router.post("/search")
async def semantic_search(req: SearchMemoryRequest):
    """Perform semantic vector search using ChromaDB."""
    if not req.query.strip():
        return {"results": []}

    results = await memory_manager.semantic_search(
        query=req.query,
        limit=req.limit,
        memory_type=req.memory_type,
    )
    return {"results": results, "query": req.query}


@router.post("/clear")
async def clear_all_memories():
    """Purge all stored memories from SQLite and ChromaDB."""
    success = await memory_manager.clear_all()
    return {"success": success, "message": "All memories cleared"}


@router.get("/stats")
async def get_memory_stats():
    """Get high-level statistics for the memory dashboard."""
    all_memories = await memory_manager.list_memories(limit=500)
    long_term = sum(1 for m in all_memories if m.get("memory_type") == "long_term")
    episodic = sum(1 for m in all_memories if m.get("memory_type") == "episodic")

    return {
        "total_memories": len(all_memories),
        "long_term_count": long_term,
        "episodic_count": episodic,
        "vector_store_ready": memory_manager.vector_store.is_ready,
        "memory_enabled": memory_manager.is_enabled,
    }
