from openai import AsyncOpenAI

from app.core.config import Settings
from app.schemas.chat import ChatMessage


class OpenRouterProvider:
    async def create_chat_completion(self, model: str, messages: list[ChatMessage]) -> str:
        current_settings = Settings()
        base_url = getattr(current_settings, "open_router_base_url", "https://openrouter.ai/api/v1")

        if not current_settings.open_router_api_key:
            raise RuntimeError("OPEN_ROUTER_API_KEY is missing in environment.")

        client = AsyncOpenAI(base_url=base_url, api_key=current_settings.open_router_api_key)

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

    async def generate_answer(self, model: str, prompt: str) -> str:
        current_settings = Settings()
        base_url = getattr(current_settings, "open_router_base_url", "https://openrouter.ai/api/v1")

        if not current_settings.open_router_api_key:
            raise RuntimeError("OPEN_ROUTER_API_KEY is missing in environment.")

        client = AsyncOpenAI(base_url=base_url, api_key=current_settings.open_router_api_key)

        try:
            completion = await client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": "Use only provided context when answering."},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.2,
            )
        except Exception as exc:
            raise RuntimeError(f"Provider request failed: {exc}") from exc

        if completion.choices and completion.choices[0].message:
            return completion.choices[0].message.content or ""

        return ""

    async def embed_texts(self, texts: list[str]) -> list[list[float]]:
        current_settings = Settings()
        base_url = getattr(current_settings, "open_router_base_url", "https://openrouter.ai/api/v1")
        embed_model = getattr(current_settings, "open_router_embed_model", "openai/text-embedding-3-small")

        if not current_settings.open_router_api_key:
            raise RuntimeError("OPEN_ROUTER_API_KEY is missing in environment.")

        client = AsyncOpenAI(base_url=base_url, api_key=current_settings.open_router_api_key)

        try:
            response = await client.embeddings.create(
                model=embed_model,
                input=texts,
            )
        except Exception as exc:
            raise RuntimeError(f"Provider embedding request failed: {exc}") from exc

        return [item.embedding for item in response.data]


openrouter_provider = OpenRouterProvider()