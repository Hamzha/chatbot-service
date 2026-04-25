from typing import Literal

from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str = Field(min_length=1)


class ChatRequest(BaseModel):
    model: str | None = None
    messages: list[ChatMessage] = Field(min_length=1)
    user_id: str | None = Field(default=None, min_length=1)
    top_k: int = Field(default=4, ge=1, le=20)
    conversation_context: str | None = Field(default=None, max_length=20000)
    source_ids: list[str] | None = Field(
        default=None,
        description="If set, retrieval is limited to these stored source ids.",
    )


class ChatResponse(BaseModel):
    model: str
    output_text: str
    sources: list[str] = Field(default_factory=list)
    num_contexts: int = 0