from __future__ import annotations

import hashlib

from app.contracts import IngestInput, IngestOutput, QueryInput, QueryOutput
from app.pdf_loader import load_and_chunk_pdf
from app.providers import Embedder, Generator
from app.vector_store import ChromaVectorStore


def _deterministic_id(source_id: str, i: int) -> str:
    return hashlib.sha256(f"{source_id}:{i}".encode("utf-8")).hexdigest()[:32]


class IngestPdfUseCase:
    def __init__(self, embedder: Embedder, store: ChromaVectorStore) -> None:
        self.embedder = embedder
        self.store = store

    def execute(self, data: IngestInput) -> IngestOutput:
        chunks = load_and_chunk_pdf(data.pdf_path)
        if not chunks:
            return IngestOutput(ingested=0, source=data.source_id)
        vectors = self.embedder.embed_texts(chunks)
        ids = [_deterministic_id(data.source_id, i) for i in range(len(chunks))]
        self.store.upsert(ids=ids, vectors=vectors, docs=chunks, sources=[data.source_id] * len(chunks))
        return IngestOutput(ingested=len(chunks), source=data.source_id)


class QueryRagUseCase:
    def __init__(self, embedder: Embedder, generator: Generator, store: ChromaVectorStore) -> None:
        self.embedder = embedder
        self.generator = generator
        self.store = store

    def execute(self, data: QueryInput) -> QueryOutput:
        question_vector = self.embedder.embed_texts([data.question])[0]
        contexts = self.store.search(question_vector, top_k=data.top_k)
        context_block = "\n\n".join(f"- {c.text}" for c in contexts)
        prompt = (
            "Use the following context to answer the question.\n\n"
            f"Context:\n{context_block}\n\n"
            f"Question: {data.question}\n"
            "Answer concisely and only from context."
        )
        answer = self.generator.generate_answer(prompt)
        return QueryOutput(
            answer=answer.strip(),
            sources=sorted({c.source for c in contexts}),
            num_contexts=len(contexts),
        )

