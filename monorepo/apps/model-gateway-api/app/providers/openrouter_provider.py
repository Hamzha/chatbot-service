from openai import AsyncOpenAI

from app.core.config import Settings
from app.schemas.chat import ChatMessage


class OpenRouterProvider:
    async def create_chat_completion(self, model: str, messages: list[ChatMessage]) -> str:
        current_settings = Settings()

        if not current_settings.open_router_api_key:
            raise RuntimeError("OPEN_ROUTER_API_KEY is missing in environment.")

        client = AsyncOpenAI(base_url="https://openrouter.ai/api/v1", api_key=current_settings.open_router_api_key)

        try:
            completion = await client.chat.completions.create(
                model=model,
                messages=[{"role": message.role, "content": message.content} for message in messages],
            )
        except Exception as exc:
            raise RuntimeError(f"Provider request failed: {exc}") from exc

        if completion.choices and completion.choices[0].message:
            return completion.choices[0].message.content or ""

        return ""


openrouter_provider = OpenRouterProvider()