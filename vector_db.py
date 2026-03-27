import os
from typing import Any

import chromadb


class ChromaStorage:
    def __init__(self, persist_dir: str = "./chroma_data", collection: str = "docs"):
        self.persist_dir = os.getenv("CHROMA_PERSIST_DIR", persist_dir)
        self.collection_name = collection

        os.makedirs(self.persist_dir, exist_ok=True)
        self.client = chromadb.PersistentClient(path=self.persist_dir)

        # Persisted collections keep their indexing configuration; set cosine for similarity.
        self.collection = self.client.get_or_create_collection(
            name=self.collection_name,
            metadata={"hnsw:space": "cosine"},
        )

    def upsert(self, ids, vectors, payloads):
        # Chroma stores embeddings alongside the provided documents + metadata.
        documents = [p.get("text", "") for p in payloads]
        metadatas = [{"source": p.get("source", "")} for p in payloads]

        self.collection.upsert(
            ids=list(ids),
            embeddings=vectors,
            documents=documents,
            metadatas=metadatas,
        )

    def search(self, query_vector, top_k: int = 5) -> dict[str, Any]:
        res = self.collection.query(
            query_embeddings=[query_vector],
            n_results=top_k,
            include=["documents", "metadatas"],
        )

        contexts: list[str] = []
        sources: set[str] = set()

        documents = res.get("documents", [[]])[0] or []
        metadatas = res.get("metadatas", [[]])[0] or []

        for doc, meta in zip(documents, metadatas):
            if doc:
                contexts.append(doc)
                if isinstance(meta, dict):
                    source = meta.get("source", "") or ""
                    if source:
                        sources.add(source)

        return {"contexts": contexts, "sources": list(sources)}

