from pathlib import Path

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


PROJECT_ROOT = Path(__file__).resolve().parents[2]
MONOREPO_ROOT = Path(__file__).resolve().parents[4]


def _gateway_env_files() -> tuple[str, ...]:
    """Monorepo `.env.shared` first, then this app's `.env.local` (local overrides shared)."""
    paths: list[str] = []
    shared = MONOREPO_ROOT / ".env.shared"
    if shared.is_file():
        paths.append(str(shared))
    local = PROJECT_ROOT / ".env.local"
    if local.is_file():
        paths.append(str(local))
    return tuple(paths)


class Settings(BaseSettings):
    app_name: str = "Model Gateway API"
    app_env: str = "development"
    app_version: str = "0.1.0"
    api_prefix: str = "/api"
    open_router_api_key: str = ""
    default_model: str = "openai/gpt-oss-120b:free"
    open_router_base_url: str = "https://openrouter.ai/api/v1"
    #: Embeddings: `openrouter` (hosted API) or `ollama` (local `/api/embeddings`).
    embedding_backend: str = "openrouter"
    ollama_base_url: str = "http://127.0.0.1:11434"
    #: Used when `EMBEDDING_BACKEND=ollama`. Falls back to `EMBEDDING_MODEL` if unset.
    ollama_embedding_model: str = ""
    embedding_model: str = "openai/text-embedding-3-small"
    open_router_embed_model: str = ""
    chroma_persist_dir: str = str(MONOREPO_ROOT / "chroma_data")
    chroma_collection: str = "chatbot_chunks"
    #: Chroma distance above which a retrieved chunk is considered irrelevant.
    #: `num_contexts` in RAG responses counts only chunks with distance <= this value,
    #: so callers (e.g. widget auto-escalation) can detect "no useful context" answers
    #: even when retrieval still returns top_k chunks. Default tuned for L2 with
    #: normalized embeddings (cos_sim ~0.5).
    rag_relevance_max_distance: float = 1.0
    max_upload_size_bytes: int = 10 * 1024 * 1024

    model_config = SettingsConfigDict(
        env_file=_gateway_env_files(),
        env_file_encoding="utf-8",
    )

    @model_validator(mode="after")
    def resolve_shared_paths(self) -> "Settings":
        chroma = Path(self.chroma_persist_dir)
        if not chroma.is_absolute():
            object.__setattr__(self, "chroma_persist_dir", str((MONOREPO_ROOT / chroma).resolve()))
        return self


settings = Settings()


FREE_MODELS = [
    "openai/gpt-oss-120b:free",
    "openai/gpt-oss-20b:free",
    "google/gemma-3n-2b-it:free",
    "google/gemma-3n-4b-it:free",
]
