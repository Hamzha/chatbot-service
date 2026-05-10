from __future__ import annotations

from typing import Protocol

import requests
from requests.exceptions import Timeout as RequestsTimeout
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


def _ollama_timeout(connect_s: float, read_s: float) -> tuple[float, float]:
    """Separate connect vs read so slow generation does not fail on connect phase."""
    return (connect_s, read_s)


class OpenRouterEmbedder:
    """OpenRouter `/v1/embeddings` (same request shape as model-gateway-api)."""

    def __init__(self, api_key: str, model: str, base_url: str) -> None:
        self.api_key = api_key.strip()
        self.model = model.strip()
        root = base_url.rstrip("/")
        self.url = root if root.endswith("/v1") else f"{root}/v1"
        self.embed_url = f"{self.url}/embeddings"

    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        if not self.api_key:
            raise RuntimeError("OPEN_ROUTER_API_KEY is missing for OpenRouter embeddings.")
        if not self.model:
            raise RuntimeError("OPENROUTER_EMBEDDING_MODEL is missing.")
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": self.model,
            "input": [
                {"content": [{"type": "text", "text": text}]}
                for text in texts
            ],
            "encoding_format": "float",
        }
        resp = requests.post(self.embed_url, headers=headers, json=payload, timeout=120.0)
        if resp.status_code != 200:
            raise RuntimeError(
                f"OpenRouter embedding request failed: HTTP {resp.status_code} - {(resp.text or '')[:500]}"
            )
        data = resp.json()
        if "data" not in data or not data["data"]:
            raise RuntimeError("OpenRouter returned no embedding data.")
        return [item["embedding"] for item in data["data"]]


class OllamaEmbedder:
    def __init__(self, base_url: str, model: str, timeout_s: int) -> None:
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.timeout_s = timeout_s

    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        vectors: list[list[float]] = []
        for text in texts:
            try:
                resp = requests.post(
                    f"{self.base_url}/api/embeddings",
                    json={"model": self.model, "prompt": text},
                    timeout=_ollama_timeout(15.0, float(self.timeout_s)),
                )
            except RequestsTimeout as e:
                raise RuntimeError(
                    f"Ollama embeddings timed out after {self.timeout_s}s (model={self.model!r}). "
                    "Increase OLLAMA_TIMEOUT_SECONDS or use a smaller embed model."
                ) from e
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
        try:
            resp = requests.post(
                f"{self.base_url}/api/generate",
                json={
                    "model": self.model,
                    "prompt": "Use only provided context when answering.\n\n" + prompt,
                    "stream": False,
                    "options": {"temperature": 0.2},
                },
                timeout=_ollama_timeout(15.0, float(self.timeout_s)),
            )
        except RequestsTimeout as e:
            raise RuntimeError(
                f"Ollama chat generation timed out after {self.timeout_s}s read (model={self.model!r}). "
                "Local models can be slow; set OLLAMA_GENERATE_TIMEOUT_SECONDS higher (e.g. 900), "
                "use a smaller/faster model, or shorten the prompt/context."
            ) from e
        _raise_for_ollama_status(resp, what=f"generate (model={self.model!r})")
        data = resp.json()
        answer = (data.get("response") or "").strip()
        if not answer:
            raise RuntimeError("Ollama returned an empty answer.")
        return answer


def _build_embedder() -> Embedder:
    eb = settings.effective_embedding_backend
    if eb == "openrouter":
        return OpenRouterEmbedder(
            api_key=settings.open_router_api_key,
            model=settings.resolved_openrouter_embedding_model,
            base_url=settings.open_router_base_url,
        )
    if eb == "openai":
        return OpenAIEmbedder(
            api_key=settings.openai_api_key,
            model=settings.resolved_openai_embed_model,
        )
    return OllamaEmbedder(
        base_url=settings.ollama_base_url,
        model=settings.resolved_ollama_embed_model,
        timeout_s=settings.ollama_timeout_seconds,
    )


def _build_generator() -> Generator:
    provider = settings.model_provider.lower().strip()
    if provider == "ollama":
        return OllamaGenerator(
            base_url=settings.ollama_base_url,
            model=settings.ollama_chat_model,
            timeout_s=settings.ollama_generate_timeout_seconds,
        )
    return OpenAIGenerator(api_key=settings.openai_api_key, model=settings.openai_chat_model)


def build_provider_clients() -> tuple[Embedder, Generator]:
    return _build_embedder(), _build_generator()

