from __future__ import annotations

from pydantic import BaseModel, Field


class RetrievedContext(BaseModel):
    text: str
    source: str


class RagTextIngestRequest(BaseModel):
    user_id: str = Field(min_length=1)
    source_id: str = Field(min_length=1, max_length=2048)
    text_content: str = Field(default="", max_length=2_000_000)


class RagQueryRequest(BaseModel):
    user_id: str = Field(min_length=1)
    model: str = Field(min_length=1)
    question: str = Field(min_length=1)
    top_k: int = Field(default=4, ge=1, le=20)
    conversation_context: str | None = Field(default=None, max_length=20000)
    source_ids: list[str] | None = Field(default=None)


class RagQueryResponse(BaseModel):
    answer: str
    sources: list[str]
    num_contexts: int


class RagIngestResponse(BaseModel):
    ingested: int
    source: str