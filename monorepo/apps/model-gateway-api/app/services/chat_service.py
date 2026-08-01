from __future__ import annotations

from app.core.config import FREE_MODELS, settings
from app.providers.openrouter_provider import openrouter_provider
from app.rag.engine import IngestPdfUseCase, IngestTextUseCase, QueryRagUseCase
from app.rag.vector_store import ChromaVectorStore
from app.schemas.chat import ChatRequest, ChatResponse
from app.schemas.rag import RagQueryRequest


def _normalize_source_ids(raw: list[str] | None) -> list[str] | None:
    if not raw:
        return None
    out = [source_id.strip() for source_id in raw if source_id.strip()]
    return out or None


def _conversation_context_from_messages(messages) -> str | None:
    prior_messages = messages[:-1]
    if not prior_messages:
        return None
    lines = [f"{message.role}: {message.content}" for message in prior_messages]
    return "\n".join(lines).strip() or None


rag_store = ChromaVectorStore()
rag_ingest_pdf_use_case = IngestPdfUseCase(provider=openrouter_provider, store=rag_store)
rag_ingest_text_use_case = IngestTextUseCase(provider=openrouter_provider, store=rag_store)
rag_query_use_case = QueryRagUseCase(provider=openrouter_provider, store=rag_store)


class ChatService:
    async def create_chat_completion(self, payload: ChatRequest) -> ChatResponse:
        selected_model = payload.model or settings.default_model
        if selected_model not in FREE_MODELS:
            raise ValueError(
                f"Unsupported model: {selected_model}. Allowed models: {', '.join(FREE_MODELS)}"
            )

        if payload.user_id:
            question = next((message.content for message in reversed(payload.messages) if message.role == "user"), "")
            if not question.strip():
                raise ValueError("RAG requests must include at least one user message")
            rag_payload = RagQueryRequest(
                user_id=payload.user_id,
                model=selected_model,
                question=question,
                top_k=payload.top_k,
                conversation_context=payload.conversation_context or _conversation_context_from_messages(payload.messages),
                source_ids=_normalize_source_ids(payload.source_ids),
            )
            result = await rag_query_use_case.execute(rag_payload)
            return ChatResponse(
                model=selected_model,
                output_text=result.answer,
                sources=result.sources,
                num_contexts=result.num_contexts,
            )

        output_text = await openrouter_provider.create_chat_completion(
            model=selected_model,
            messages=payload.messages,
        )

        return ChatResponse(model=selected_model, output_text=output_text)


chat_service = ChatService()