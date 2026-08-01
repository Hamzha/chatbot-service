from __future__ import annotations

from uuid import uuid4

import pytest

from app.core.config import settings
from app.rag.engine import IngestTextUseCase, QueryRagUseCase
from app.rag.vector_store import ChromaVectorStore
from app.schemas.rag import RagQueryRequest, RagTextIngestRequest


class FakeProvider:
    def __init__(self) -> None:
        self.prompts: list[str] = []

    async def embed_texts(self, texts: list[str]) -> list[list[float]]:
        vectors: list[list[float]] = []
        for text in texts:
            lowered = text.lower()
            vectors.append([1.0, 0.0] if "policy" in lowered else [0.0, 1.0])
        return vectors

    async def generate_answer(self, model: str, prompt: str) -> str:
        self.prompts.append(prompt)
        return f"answer-for-{model}"


@pytest.mark.anyio
async def test_rag_pipeline_retrieves_matching_chunks(tmp_path):
    original_dir = settings.chroma_persist_dir
    original_collection = settings.chroma_collection
    try:
        settings.chroma_persist_dir = str(tmp_path / "chroma")
        settings.chroma_collection = f"test_chunks_{uuid4().hex}"

        store = ChromaVectorStore()
        provider = FakeProvider()
        ingest_use_case = IngestTextUseCase(provider=provider, store=store)
        query_use_case = QueryRagUseCase(provider=provider, store=store)

        await ingest_use_case.execute(
            RagTextIngestRequest(
                user_id="u1",
                source_id="policy-doc",
                text_content="Policy details and refund policy text.",
            )
        )
        await ingest_use_case.execute(
            RagTextIngestRequest(
                user_id="u1",
                source_id="shipping-doc",
                text_content="Shipping details and delivery windows.",
            )
        )

        result = await query_use_case.execute(
            RagQueryRequest(
                user_id="u1",
                model="openai/gpt-oss-120b:free",
                question="What is the refund policy?",
                top_k=1,
            )
        )

        assert result.answer == "answer-for-openai/gpt-oss-120b:free"
        assert result.num_contexts >= 1
        assert "policy-doc" in result.sources
        assert "refund policy" in provider.prompts[-1].lower()
    finally:
        settings.chroma_persist_dir = original_dir
        settings.chroma_collection = original_collection