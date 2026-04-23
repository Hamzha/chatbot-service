from app.core.config import FREE_MODELS, settings
from app.providers.openrouter_provider import openrouter_provider
from app.schemas.chat import ChatRequest, ChatResponse


class ChatService:
    async def create_chat_completion(self, payload: ChatRequest) -> ChatResponse:
        selected_model = payload.model or settings.default_model
        if selected_model not in FREE_MODELS:
            raise ValueError(
                f"Unsupported model: {selected_model}. Allowed models: {', '.join(FREE_MODELS)}"
            )

        output_text = await openrouter_provider.create_chat_completion(
            model=selected_model,
            messages=payload.messages,
        )

        return ChatResponse(model=selected_model, output_text=output_text)


chat_service = ChatService()