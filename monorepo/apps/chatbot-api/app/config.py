from __future__ import annotations

from pathlib import Path

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


MONOREPO_ROOT = Path(__file__).resolve().parents[3]
_CHATBOT_APP_ROOT = Path(__file__).resolve().parents[1]


def _chatbot_env_files() -> tuple[str, ...]:
    """Monorepo `.env.shared` first, then app `.env` / `.env.local` (later wins on duplicate keys)."""
    paths: list[str] = []
    shared = MONOREPO_ROOT / ".env.shared"
    if shared.is_file():
        paths.append(str(shared))
    for name in (".env", ".env.local"):
        p = _CHATBOT_APP_ROOT / name
        if p.is_file():
            paths.append(str(p))
    return tuple(paths)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=_chatbot_env_files(),
        env_file_encoding="utf-8",
    )

    app_env: str = "development"
    app_host: str = "127.0.0.1"
    app_port: int = 8001
    log_level: str = "INFO"

    model_provider: str = "openai"
    #: Where **embeddings** are computed: `ollama`, `openrouter`, or `openai`.
    #: Leave empty to mirror `MODEL_PROVIDER` (legacy behavior).
    embedding_backend: str = ""
    #: Optional legacy single override; also used as fallback when the backend-specific model below is empty.
    embedding_model: str = ""

    openai_api_key: str = ""
    openai_chat_model: str = "gpt-4o-mini"
    openai_embed_model: str = "text-embedding-3-small"

    ollama_base_url: str = "http://127.0.0.1:11434"
    ollama_chat_model: str = "qwen2.5:14b"
    ollama_embed_model: str = "nomic-embed-text"
    #: Explicit Ollama embedding model when `EMBEDDING_BACKEND=ollama` (preferred over `EMBEDDING_MODEL`).
    ollama_embedding_model: str = ""

    open_router_api_key: str = ""
    open_router_base_url: str = "https://openrouter.ai/api/v1"
    #: Explicit OpenRouter embedding slug when `EMBEDDING_BACKEND=openrouter`.
    openrouter_embedding_model: str = ""
    #: Per-request timeout for `/api/embeddings` (each chunk).
    ollama_timeout_seconds: int = 180
    #: Read timeout for `/api/generate` (full RAG answer); local models often need several minutes.
    ollama_generate_timeout_seconds: int = 600

    chroma_persist_dir: str = str(MONOREPO_ROOT / "chroma_data")
    chroma_collection: str = "chatbot_chunks"
    #: Chroma distance above which a retrieved chunk is considered irrelevant.
    #: `num_contexts` in RAG responses counts only chunks with distance <= this value,
    #: so callers (e.g. widget auto-escalation) can detect "no useful context" answers
    #: even when retrieval still returns top_k chunks. Default tuned for L2 with
    #: normalized embeddings (cos_sim ~0.5).
    rag_relevance_max_distance: float = 1.0

    cors_allow_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    max_upload_size_bytes: int = 10 * 1024 * 1024
    auth_jwt_secret: str = ""
    service_api_key: str = ""

    inngest_app_id: str = "chatbot_engine"
    inngest_api_base_url: str = "http://127.0.0.1:8288/v1"
    inngest_event_api_base_url: str = "http://127.0.0.1:8288/"

    @property
    def is_production(self) -> bool:
        return self.app_env.lower().strip() == "production"

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.cors_allow_origins.split(",") if o.strip()]

    @property
    def resolved_openai_embed_model(self) -> str:
        return self.embedding_model.strip() or self.openai_embed_model.strip()

    @property
    def resolved_ollama_embed_model(self) -> str:
        """Ollama embedding model name for the active embedder (legacy name)."""
        return (
            self.ollama_embedding_model.strip()
            or self.embedding_model.strip()
            or self.ollama_embed_model.strip()
        )

    @property
    def resolved_openrouter_embedding_model(self) -> str:
        return self.openrouter_embedding_model.strip() or self.embedding_model.strip()

    @property
    def effective_embedding_backend(self) -> str:
        """Unset `EMBEDDING_BACKEND` follows `MODEL_PROVIDER` (openai | ollama only)."""
        raw = self.embedding_backend.strip().lower()
        if raw:
            return raw
        mp = self.model_provider.strip().lower()
        return mp if mp in {"ollama", "openai"} else "openai"

    @model_validator(mode="after")
    def resolve_shared_paths(self) -> "Settings":
        chroma = Path(self.chroma_persist_dir)
        if not chroma.is_absolute():
            object.__setattr__(self, "chroma_persist_dir", str((MONOREPO_ROOT / chroma).resolve()))
        return self

    @model_validator(mode="after")
    def validate_provider_config(self) -> "Settings":
        provider = self.model_provider.lower().strip()
        eb = self.embedding_backend.strip().lower()
        if eb and eb not in {"ollama", "openrouter", "openai"}:
            raise ValueError("EMBEDDING_BACKEND must be one of: ollama, openrouter, openai (or empty)")
        eff = self.effective_embedding_backend
        if eff == "openrouter" and not self.open_router_api_key.strip():
            raise ValueError("OPEN_ROUTER_API_KEY is required when EMBEDDING_BACKEND=openrouter")
        if eff == "openrouter" and not self.resolved_openrouter_embedding_model:
            raise ValueError(
                "Set OPENROUTER_EMBEDDING_MODEL (or EMBEDDING_MODEL) when EMBEDDING_BACKEND=openrouter"
            )
        if eff == "ollama" and not self.ollama_base_url.strip():
            raise ValueError("OLLAMA_BASE_URL is required for Ollama embeddings")
        if eff == "ollama" and not self.resolved_ollama_embed_model:
            raise ValueError(
                "Set OLLAMA_EMBEDDING_MODEL (or OLLAMA_EMBED_MODEL / EMBEDDING_MODEL) for Ollama embeddings"
            )
        if eff == "openai" and self.is_production and not self.openai_api_key.strip():
            raise ValueError("OPENAI_API_KEY is required in production for OpenAI embeddings")

        if provider not in {"openai", "ollama"}:
            raise ValueError("MODEL_PROVIDER must be either 'openai' or 'ollama'")
        if provider == "openai" and self.is_production and not self.openai_api_key.strip():
            raise ValueError("OPENAI_API_KEY is required in production when MODEL_PROVIDER=openai")
        if provider == "ollama":
            if not self.ollama_base_url.strip():
                raise ValueError("OLLAMA_BASE_URL is required when MODEL_PROVIDER=ollama")
            if not self.ollama_chat_model.strip() or not self.resolved_ollama_embed_model:
                raise ValueError(
                    "OLLAMA_CHAT_MODEL and EMBEDDING_MODEL (or OLLAMA_EMBED_MODEL) are required for ollama"
                )
        if self.max_upload_size_bytes < 1024:
            raise ValueError("MAX_UPLOAD_SIZE_BYTES must be >= 1024")
        if self.is_production and not (self.auth_jwt_secret.strip() or self.service_api_key.strip()):
            raise ValueError("Production requires AUTH_JWT_SECRET or SERVICE_API_KEY")
        return self


settings = Settings()

