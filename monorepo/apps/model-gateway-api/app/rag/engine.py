from __future__ import annotations

import hashlib
from app.providers.openrouter_provider import OpenRouterProvider
from app.schemas.rag import RagIngestResponse, RagQueryRequest, RagQueryResponse, RagTextIngestRequest

from .pdf_loader import chunk_text, load_and_chunk_pdf
from .vector_store import ChromaVectorStore


def _deterministic_id(user_id: str, source_id: str, index: int) -> str:
    return hashlib.sha256(f"{user_id}:{source_id}:{index}".encode("utf-8")).hexdigest()[:32]


def _replace_source_chunks_atomically(
    *,
    store: ChromaVectorStore,
    user_id: str,
    source_id: str,
    chunks: list[str],
    vectors: list[list[float]],
) -> None:
    old_count = store.count_source_chunks(user_id=user_id, source_id=source_id)
    ids = [_deterministic_id(user_id, source_id, i) for i in range(len(chunks))]
    store.upsert(
        ids=ids,
        vectors=vectors,
        docs=chunks,
        sources=[source_id] * len(chunks),
        user_ids=[user_id] * len(chunks),
    )
    if old_count > len(chunks):
        stale_ids = [_deterministic_id(user_id, source_id, i) for i in range(len(chunks), old_count)]
        store.delete_ids(stale_ids)


class IngestPdfUseCase:
    def __init__(self, provider: OpenRouterProvider, store: ChromaVectorStore) -> None:
        self.provider = provider
        self.store = store

    async def execute(self, pdf_path: str, user_id: str, source_id: str) -> RagIngestResponse:
        chunks = load_and_chunk_pdf(pdf_path)
        if not chunks:
            self.store.delete_source(user_id=user_id, source_id=source_id)
            return RagIngestResponse(ingested=0, source=source_id)
        vectors = await self.provider.embed_texts(chunks)
        _replace_source_chunks_atomically(
            store=self.store,
            user_id=user_id,
            source_id=source_id,
            chunks=chunks,
            vectors=vectors,
        )
        return RagIngestResponse(ingested=len(chunks), source=source_id)


class IngestTextUseCase:
    def __init__(self, provider: OpenRouterProvider, store: ChromaVectorStore) -> None:
        self.provider = provider
        self.store = store

    async def execute(self, data: RagTextIngestRequest) -> RagIngestResponse:
        chunks = chunk_text(data.text_content)
        if not chunks:
            self.store.delete_source(user_id=data.user_id, source_id=data.source_id)
            return RagIngestResponse(ingested=0, source=data.source_id)
        vectors = await self.provider.embed_texts(chunks)
        _replace_source_chunks_atomically(
            store=self.store,
            user_id=data.user_id,
            source_id=data.source_id,
            chunks=chunks,
            vectors=vectors,
        )
        return RagIngestResponse(ingested=len(chunks), source=data.source_id)


class QueryRagUseCase:
    def __init__(self, provider: OpenRouterProvider, store: ChromaVectorStore) -> None:
        self.provider = provider
        self.store = store

    async def execute(self, data: RagQueryRequest) -> RagQueryResponse:
        print(
            "[rag-debug] query incoming",
            {
                "user_id": data.user_id,
                "source_ids": data.source_ids or [],
                "top_k": data.top_k,
            },
        )

        question_vector = (await self.provider.embed_texts([data.question]))[0]
        contexts = self.store.search(
            question_vector,
            top_k=data.top_k,
            user_id=data.user_id,
            source_ids=data.source_ids,
        )
        print(
            "[rag-debug] query retrieved",
            {
                "num_contexts": len(contexts),
                "sources": sorted({c.source for c in contexts}),
            },
        )
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
        answer = await self.provider.generate_answer(data.model, prompt)
        return RagQueryResponse(
            answer=answer.strip(),
            sources=sorted({c.source for c in contexts}),
            num_contexts=len(contexts),
        )