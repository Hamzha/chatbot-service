from __future__ import annotations

import hashlib

from app.contracts import IngestInput, IngestOutput, QueryInput, QueryOutput
from app.pdf_loader import load_and_chunk_pdf
from app.providers import Embedder, Generator
from app.vector_store import ChromaVectorStore


def _deterministic_id(user_id: str, source_id: str, i: int) -> str:
    return hashlib.sha256(f"{user_id}:{source_id}:{i}".encode("utf-8")).hexdigest()[:32]


class IngestPdfUseCase:
    def __init__(self, embedder: Embedder, store: ChromaVectorStore) -> None:
        self.embedder = embedder
        self.store = store

    def execute(self, data: IngestInput) -> IngestOutput:
        chunks = load_and_chunk_pdf(data.pdf_path)
        if not chunks:
            return IngestOutput(ingested=0, source=data.source_id)
        vectors = self.embedder.embed_texts(chunks)
        ids = [_deterministic_id(data.user_id, data.source_id, i) for i in range(len(chunks))]
        self.store.upsert(
            ids=ids,
            vectors=vectors,
            docs=chunks,
            sources=[data.source_id] * len(chunks),
            user_ids=[data.user_id] * len(chunks),
        )
        return IngestOutput(ingested=len(chunks), source=data.source_id)


class QueryRagUseCase:
    def __init__(self, embedder: Embedder, generator: Generator, store: ChromaVectorStore) -> None:
        self.embedder = embedder
        self.generator = generator
        self.store = store

    def execute(self, data: QueryInput) -> QueryOutput:
        question_vector = self.embedder.embed_texts([data.question])[0]
        contexts = self.store.search(question_vector, top_k=data.top_k, user_id=data.user_id)
        context_block = "\n\n".join(f"- {c.text}" for c in contexts)
        prior = ""
        if data.conversation_context and data.conversation_context.strip():
            prior = (
                "Prior conversation (for follow-up questions; do not contradict without document support):\n"
                f"{data.conversation_context.strip()}\n\n"
            )
        prompt = (
            prior
            + "Use the following document excerpts to answer the current question. "
            "If the excerpts do not contain the answer, say so.\n\n"
            f"Document excerpts:\n{context_block}\n\n"
            f"Current question: {data.question}\n"
            "Answer concisely; prefer facts from the document excerpts."
        )
        answer = self.generator.generate_answer(prompt)
        return QueryOutput(
            answer=answer.strip(),
            sources=sorted({c.source for c in contexts}),
            num_contexts=len(contexts),
        )

