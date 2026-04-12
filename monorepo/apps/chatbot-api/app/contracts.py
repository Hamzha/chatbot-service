from pydantic import BaseModel, Field


class QueryInput(BaseModel):
    user_id: str = Field(min_length=1)
    question: str = Field(min_length=1)
    top_k: int = Field(default=4, ge=1, le=20)
    conversation_context: str | None = Field(
        default=None,
        max_length=20000,
        description="Prior user/assistant turns; included in the prompt, not used for retrieval.",
    )
    source_ids: list[str] | None = Field(
        default=None,
        description="If set, retrieval is limited to these Chroma source ids (non-empty).",
    )


class QueryRequest(BaseModel):
    question: str = Field(min_length=1)
    top_k: int = Field(default=4, ge=1, le=20)
    conversation_context: str | None = Field(
        default=None,
        max_length=20000,
    )
    source_ids: list[str] | None = Field(
        default=None,
        description="If set, retrieval is limited to these Chroma source ids (non-empty).",
    )


class QueryOutput(BaseModel):
    answer: str
    sources: list[str]
    num_contexts: int


class IngestInput(BaseModel):
    user_id: str = Field(min_length=1)
    pdf_path: str = Field(min_length=1)
    source_id: str = Field(min_length=1)


class IngestOutput(BaseModel):
    ingested: int
    source: str


class RetrievedContext(BaseModel):
    text: str
    source: str

