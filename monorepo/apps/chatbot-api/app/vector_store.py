from __future__ import annotations

import chromadb

from app.config import settings
from app.contracts import RetrievedContext


def _where_user_eq(user_id: str) -> dict:
    """Chroma 1.5+ expects operator form for metadata filters."""
    return {"user_id": {"$eq": user_id}}


def _where_user_and_source_eq(user_id: str, source_id: str) -> dict:
    """Compound filters must use $and; multiple keys in one dict are invalid."""
    return {
        "$and": [
            {"user_id": {"$eq": user_id}},
            {"source": {"$eq": source_id}},
        ]
    }


def _where_user_and_sources_in(user_id: str, source_ids: list[str]) -> dict:
    """Restrict retrieval to a set of source ids for this user."""
    if len(source_ids) == 1:
        return _where_user_and_source_eq(user_id, source_ids[0])
    or_clauses = [{"source": {"$eq": sid}} for sid in source_ids]
    return {"$and": [{"user_id": {"$eq": user_id}}, {"$or": or_clauses}]}


class ChromaVectorStore:
    def __init__(self) -> None:
        self.client = chromadb.PersistentClient(path=settings.chroma_persist_dir)
        self.collection = self.client.get_or_create_collection(settings.chroma_collection)

    def upsert(
        self,
        ids: list[str],
        vectors: list[list[float]],
        docs: list[str],
        sources: list[str],
        user_ids: list[str],
    ) -> None:
        self.collection.upsert(
            ids=ids,
            embeddings=vectors,
            documents=docs,
            metadatas=[{"source": s, "user_id": u} for s, u in zip(sources, user_ids)],
        )

    def search(
        self,
        query_vector: list[float],
        top_k: int,
        user_id: str,
        source_ids: list[str] | None = None,
    ) -> list[RetrievedContext]:
        where_filter: dict
        if source_ids:
            where_filter = _where_user_and_sources_in(user_id, source_ids)
        else:
            where_filter = _where_user_eq(user_id)
        res = self.collection.query(
            query_embeddings=[query_vector],
            n_results=top_k,
            where=where_filter,
        )
        docs = (res.get("documents") or [[]])[0]
        metas = (res.get("metadatas") or [[]])[0]
        output: list[RetrievedContext] = []
        for i, text in enumerate(docs):
            source = "unknown"
            if i < len(metas) and isinstance(metas[i], dict):
                source = str(metas[i].get("source", "unknown"))
            output.append(RetrievedContext(text=text, source=source))
        return output

    def list_sources(self, user_id: str) -> list[dict[str, int | str]]:
        res = self.collection.get(where=_where_user_eq(user_id), include=["metadatas"])
        metas = res.get("metadatas") or []
        counts: dict[str, int] = {}
        for item in metas:
            if isinstance(item, dict):
                source = str(item.get("source", "unknown"))
                counts[source] = counts.get(source, 0) + 1
        return [{"source": source, "chunks": chunks} for source, chunks in sorted(counts.items())]

    def delete_source(self, user_id: str, source_id: str) -> int:
        res = self.collection.get(
            where=_where_user_and_source_eq(user_id, source_id),
            include=[],
        )
        ids = res.get("ids") or []
        if ids:
            self.collection.delete(ids=ids)
        return len(ids)

