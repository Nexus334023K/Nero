import hashlib
import os
from typing import Any, Dict, List, Optional

import numpy as np

from app.core.logging_config import get_logger

logger = get_logger(__name__)


class LocalEmbeddingFunction:
    """Fast, deterministic, 64-dimensional local unit-vector embedding function.
    Eliminates external model downloads while providing reliable vector similarity.
    """

    def __call__(self, input: List[str]) -> List[List[float]]:
        embeddings: List[List[float]] = []
        for text in input:
            vec = np.zeros(64, dtype=np.float32)
            words = text.lower().split()
            for word in words:
                h = int(hashlib.md5(word.encode()).hexdigest(), 16) % 64
                vec[h] += 1.0
            norm = np.linalg.norm(vec)
            if norm > 0:
                vec = vec / norm
            embeddings.append(vec.tolist())
        return embeddings


class ChromaVectorStore:
    """ChromaDB persistent vector store for semantic memory indexing and retrieval."""

    def __init__(self, persist_dir: str = "./chroma_db"):
        self.persist_dir = persist_dir
        self._client = None
        self._collection = None
        self._is_ready = False
        self._in_memory_index: Dict[str, Dict[str, Any]] = {}
        self.embedding_fn = LocalEmbeddingFunction()

        try:
            import chromadb
            from chromadb.config import Settings

            os.makedirs(self.persist_dir, exist_ok=True)
            self._client = chromadb.PersistentClient(
                path=self.persist_dir,
                settings=Settings(anonymized_telemetry=False, allow_reset=True),
            )
            self._collection = self._client.get_or_create_collection(
                name="nero_semantic_memories",
                embedding_function=self.embedding_fn,
                metadata={"description": "NERO persistent personal memory embeddings"},
            )
            self._is_ready = True
            logger.info(f"ChromaDB persistent vector store initialized at {self.persist_dir}")
        except Exception as e:
            logger.warning(
                f"ChromaDB initialization notice ({e}). Operating with resilient in-memory semantic index."
            )
            self._is_ready = False

    @property
    def is_ready(self) -> bool:
        return self._is_ready

    def add(
        self,
        memory_id: str,
        content: str,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        """Index a memory text entry with metadata."""
        meta = metadata or {}
        # Clean metadata values to primitive types supported by Chroma
        clean_meta = {
            k: str(v) if not isinstance(v, (str, int, float, bool)) else v
            for k, v in meta.items()
        }

        # Store in fallback index
        self._in_memory_index[memory_id] = {
            "content": content,
            "metadata": clean_meta,
        }

        if self._is_ready and self._collection is not None:
            try:
                self._collection.upsert(
                    ids=[memory_id],
                    documents=[content],
                    metadatas=[clean_meta],
                )
            except Exception as e:
                logger.warning(f"ChromaDB upsert error: {e}")

    def query(
        self,
        query_text: str,
        limit: int = 5,
        memory_type: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Perform semantic search against indexed memories."""
        results: List[Dict[str, Any]] = []

        if self._is_ready and self._collection is not None:
            try:
                where_filter = {"memory_type": memory_type} if memory_type else None
                query_res = self._collection.query(
                    query_texts=[query_text],
                    n_results=limit,
                    where=where_filter,
                )

                if query_res and query_res.get("ids") and len(query_res["ids"]) > 0:
                    ids = query_res["ids"][0]
                    docs = query_res["documents"][0] if query_res.get("documents") else []
                    metas = query_res["metadatas"][0] if query_res.get("metadatas") else []
                    distances = (
                        query_res["distances"][0] if query_res.get("distances") else []
                    )

                    for i, mem_id in enumerate(ids):
                        doc = docs[i] if i < len(docs) else ""
                        meta = metas[i] if i < len(metas) else {}
                        dist = distances[i] if i < len(distances) else 0.0
                        # Convert distance to similarity score between 0.0 and 1.0
                        score = max(0.0, 1.0 - (dist if dist <= 1.0 else dist / 2.0))
                        results.append(
                            {
                                "id": mem_id,
                                "content": doc,
                                "metadata": meta,
                                "score": round(score, 3),
                            }
                        )
                    return results
            except Exception as e:
                logger.warning(f"ChromaDB query error: {e}")

        # In-memory keyword & term overlap matching fallback
        query_words = set(query_text.lower().split())
        scored_entries = []

        for mem_id, item in self._in_memory_index.items():
            content = item["content"]
            meta = item["metadata"]
            if memory_type and meta.get("memory_type") != memory_type:
                continue

            content_words = set(content.lower().split())
            overlap = len(query_words.intersection(content_words))
            if overlap > 0 or len(query_words) == 0:
                score = round(overlap / max(len(query_words), 1), 3)
                scored_entries.append((score, mem_id, content, meta))

        scored_entries.sort(key=lambda x: x[0], reverse=True)

        for score, mem_id, content, meta in scored_entries[:limit]:
            results.append(
                {
                    "id": mem_id,
                    "content": content,
                    "metadata": meta,
                    "score": score,
                }
            )

        return results

    def delete(self, memory_id: str) -> None:
        """Remove a memory by ID."""
        self._in_memory_index.pop(memory_id, None)
        if self._is_ready and self._collection is not None:
            try:
                self._collection.delete(ids=[memory_id])
            except Exception as e:
                logger.warning(f"ChromaDB delete error: {e}")

    def clear(self) -> None:
        """Clear all indexed memory vectors."""
        self._in_memory_index.clear()
        if self._is_ready and self._collection is not None:
            try:
                self._collection.delete(where={})
            except Exception as e:
                logger.warning(f"ChromaDB clear error: {e}")
