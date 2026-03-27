from pydantic import BaseModel, Field


class QueryInput(BaseModel):
    question: str = Field(min_length=1)
    top_k: int = Field(default=4, ge=1, le=20)


class QueryOutput(BaseModel):
    answer: str
    sources: list[str]
    num_contexts: int


class IngestInput(BaseModel):
    pdf_path: str = Field(min_length=1)
    source_id: str = Field(min_length=1)


class IngestOutput(BaseModel):
    ingested: int
    source: str


class RetrievedContext(BaseModel):
    text: str
    source: str

