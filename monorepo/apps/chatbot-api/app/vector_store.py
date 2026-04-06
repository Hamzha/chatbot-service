from __future__ import annotations

import chromadb

from app.config import settings
from app.contracts import RetrievedContext


class ChromaVectorStore:
    def __init__(self) -> None:
        self.client = chromadb.PersistentClient(path=settings.chroma_persist_dir)
        self.collection = self.client.get_or_create_collection(settings.chroma_collection)

    def upsert(self, ids: list[str], vectors: list[list[float]], docs: list[str], sources: list[str]) -> None:
        self.collection.upsert(
            ids=ids,
            embeddings=vectors,
            documents=docs,
            metadatas=[{"source": s} for s in sources],
        )

    def search(self, query_vector: list[float], top_k: int) -> list[RetrievedContext]:
        res = self.collection.query(query_embeddings=[query_vector], n_results=top_k)
        docs = (res.get("documents") or [[]])[0]
        metas = (res.get("metadatas") or [[]])[0]
        output: list[RetrievedContext] = []
        for i, text in enumerate(docs):
            source = "unknown"
            if i < len(metas) and isinstance(metas[i], dict):
                source = str(metas[i].get("source", "unknown"))
            output.append(RetrievedContext(text=text, source=source))
        return output

