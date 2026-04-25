from openai import AsyncOpenAI
import httpx

from app.core.config import Settings
from app.schemas.chat import ChatMessage


class OpenRouterProvider:
    async def create_chat_completion(
        self,
        model: str,
        messages: list[ChatMessage]
    ) -> str:
        current_settings = Settings()
        base_url = getattr(
            current_settings,
            "open_router_base_url",
            "https://openrouter.ai/api/v1"
        )

        if not current_settings.open_router_api_key:
            raise RuntimeError(
                "OPEN_ROUTER_API_KEY is missing in environment."
            )

        client = AsyncOpenAI(
            base_url=base_url,
            api_key=current_settings.open_router_api_key
        )

        try:
            completion = await client.chat.completions.create(
                model=model,
                messages=[
                    {
                        "role": message.role,
                        "content": message.content
                    }
                    for message in messages
                ],
            )
        except Exception as exc:
            raise RuntimeError(
                f"Provider request failed: {exc}"
            ) from exc

        if completion.choices and completion.choices[0].message:
            return completion.choices[0].message.content or ""

        return ""

    async def generate_answer(
        self,
        model: str,
        prompt: str
    ) -> str:
        current_settings = Settings()
        base_url = getattr(
            current_settings,
            "open_router_base_url",
            "https://openrouter.ai/api/v1"
        )

        if not current_settings.open_router_api_key:
            raise RuntimeError(
                "OPEN_ROUTER_API_KEY is missing in environment."
            )

        client = AsyncOpenAI(
            base_url=base_url,
            api_key=current_settings.open_router_api_key
        )

        try:
            completion = await client.chat.completions.create(
                model=model,
                messages=[
                    {
                        "role": "system",
                        "content": "Use only provided context when answering."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    },
                ],
                temperature=0.2,
            )
        except Exception as exc:
            raise RuntimeError(
                f"Provider request failed: {exc}"
            ) from exc

        if completion.choices and completion.choices[0].message:
            return completion.choices[0].message.content or ""

        return ""

    async def embed_texts(
        self,
        texts: list[str]
    ) -> list[list[float]]:
        current_settings = Settings()

        embed_model = getattr(
            current_settings,
            "open_router_embed_model",
            "nvidia/llama-nemotron-embed-vl-1b-v2:free"
        )

        print(f"Embedding texts with model '{embed_model}'")
        print(f"Sending embedding request for {len(texts)} texts...")
        print(texts)

        try:
            embeddings = await generate_embeddings(texts)

            print(
                f"Received embeddings for {len(embeddings)} texts."
            )

            return embeddings

        except Exception as exc:
            print(f"Embedding request failed: {exc}")

            raise RuntimeError(
                f"Provider embedding request failed for model '{embed_model}': {exc}"
            ) from exc


async def generate_embeddings(
    texts: list[str]
) -> list[list[float]]:
    current_settings = Settings()

    api_key = current_settings.open_router_api_key

    model = getattr(
        current_settings,
        "open_router_embed_model",
        "nvidia/llama-nemotron-embed-vl-1b-v2:free"
    )

    url = "https://openrouter.ai/api/v1/embeddings"

    if not api_key:
        raise RuntimeError(
            "OPEN_ROUTER_API_KEY is missing."
        )

    payload = {
        "model": model,
        "input": [
            {
                "content": [
                    {
                        "type": "text",
                        "text": text
                    }
                ]
            }
            for text in texts
        ],
        "encoding_format": "float"
    }

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(
        timeout=60.0
    ) as client:
        response = await client.post(
            url,
            headers=headers,
            json=payload
        )

    print("Status Code:", response.status_code)

    if response.status_code != 200:
        print("Response:", response.text)

        raise RuntimeError(
            f"Embedding request failed: "
            f"{response.status_code} - {response.text}"
        )

    data = response.json()

    if "data" not in data or not data["data"]:
        raise RuntimeError(
            "No embedding data received."
        )

    return [
        item["embedding"]
        for item in data["data"]
    ]


openrouter_provider = OpenRouterProvider()