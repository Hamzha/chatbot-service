from __future__ import annotations

from typing import Protocol

import requests
from openai import OpenAI
from app.config import settings


def _ollama_error_detail(resp: requests.Response) -> str:
    try:
        data = resp.json()
        if isinstance(data, dict) and data.get("error"):
            return str(data["error"])
    except Exception:
        pass
    body = (resp.text or "").strip()
    return body[:500] if body else resp.reason


def _raise_for_ollama_status(resp: requests.Response, *, what: str) -> None:
    if resp.ok:
        return
    detail = _ollama_error_detail(resp)
    hint = ""
    if resp.status_code == 404:
        hint = (
            " Usually this means the model is not pulled: run `ollama pull <model>` "
            "with the same name as OLLAMA_CHAT_MODEL / OLLAMA_EMBED_MODEL, or fix OLLAMA_BASE_URL."
        )
    msg = f"Ollama {what} failed: HTTP {resp.status_code} at {resp.url}"
    if detail:
        msg += f". Server said: {detail}"
    msg += hint
    raise RuntimeError(msg) from None


class Embedder(Protocol):
    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        ...


class Generator(Protocol):
    def generate_answer(self, prompt: str) -> str:
        ...


class OpenAIEmbedder:
    def __init__(self, api_key: str, model: str) -> None:
        self.client = OpenAI(api_key=api_key)
        self.model = model

    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        response = self.client.embeddings.create(model=self.model, input=texts)
        return [item.embedding for item in response.data]


class OpenAIGenerator:
    def __init__(self, api_key: str, model: str) -> None:
        self.client = OpenAI(api_key=api_key)
        self.model = model

    def generate_answer(self, prompt: str) -> str:
        response = self.client.chat.completions.create(
            model=self.model,
            temperature=0.2,
            messages=[
                {"role": "system", "content": "Use only provided context when answering."},
                {"role": "user", "content": prompt},
            ],
        )
        answer = (response.choices[0].message.content or "").strip()
        if not answer:
            raise RuntimeError("OpenAI returned an empty answer.")
        return answer


class OllamaEmbedder:
    def __init__(self, base_url: str, model: str, timeout_s: int) -> None:
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.timeout_s = timeout_s

    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        vectors: list[list[float]] = []
        for text in texts:
            resp = requests.post(
                f"{self.base_url}/api/embeddings",
                json={"model": self.model, "prompt": text},
                timeout=self.timeout_s,
            )
            _raise_for_ollama_status(resp, what=f"embeddings (model={self.model!r})")
            data = resp.json()
            vectors.append(data["embedding"])
        return vectors


class OllamaGenerator:
    def __init__(self, base_url: str, model: str, timeout_s: int) -> None:
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.timeout_s = timeout_s

    def generate_answer(self, prompt: str) -> str:
        resp = requests.post(
            f"{self.base_url}/api/generate",
            json={
                "model": self.model,
                "prompt": "Use only provided context when answering.\n\n" + prompt,
                "stream": False,
                "options": {"temperature": 0.2},
            },
            timeout=self.timeout_s,
        )
        _raise_for_ollama_status(resp, what=f"generate (model={self.model!r})")
        data = resp.json()
        answer = (data.get("response") or "").strip()
        if not answer:
            raise RuntimeError("Ollama returned an empty answer.")
        return answer


def build_provider_clients() -> tuple[Embedder, Generator]:
    provider = settings.model_provider.lower().strip()
    if provider == "ollama":
        return (
            OllamaEmbedder(
                base_url=settings.ollama_base_url,
                model=settings.ollama_embed_model,
                timeout_s=settings.ollama_timeout_seconds,
            ),
            OllamaGenerator(
                base_url=settings.ollama_base_url,
                model=settings.ollama_chat_model,
                timeout_s=settings.ollama_timeout_seconds,
            ),
        )

    return (
        OpenAIEmbedder(api_key=settings.openai_api_key, model=settings.openai_embed_model),
        OpenAIGenerator(api_key=settings.openai_api_key, model=settings.openai_chat_model),
    )

