from __future__ import annotations

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", ".env.local"),
        env_file_encoding="utf-8",
    )

    app_env: str = "development"
    app_host: str = "127.0.0.1"
    app_port: int = 8001
    log_level: str = "INFO"

    model_provider: str = "openai"

    openai_api_key: str = ""
    openai_chat_model: str = "gpt-4o-mini"
    openai_embed_model: str = "text-embedding-3-small"

    ollama_base_url: str = "http://127.0.0.1:11434"
    ollama_chat_model: str = "qwen2.5:14b"
    ollama_embed_model: str = "nomic-embed-text"
    #: Per-request timeout for `/api/embeddings` (each chunk).
    ollama_timeout_seconds: int = 180
    #: Read timeout for `/api/generate` (full RAG answer); local models often need several minutes.
    ollama_generate_timeout_seconds: int = 600

    chroma_persist_dir: str = "./chroma_data"
    chroma_collection: str = "chatbot_chunks"

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

    @model_validator(mode="after")
    def validate_provider_config(self) -> "Settings":
        provider = self.model_provider.lower().strip()
        if provider not in {"openai", "ollama"}:
            raise ValueError("MODEL_PROVIDER must be either 'openai' or 'ollama'")
        if provider == "openai" and self.is_production and not self.openai_api_key.strip():
            raise ValueError("OPENAI_API_KEY is required in production when MODEL_PROVIDER=openai")
        if provider == "ollama":
            if not self.ollama_base_url.strip():
                raise ValueError("OLLAMA_BASE_URL is required when MODEL_PROVIDER=ollama")
            if not self.ollama_chat_model.strip() or not self.ollama_embed_model.strip():
                raise ValueError("OLLAMA_CHAT_MODEL and OLLAMA_EMBED_MODEL are required for ollama")
        if self.max_upload_size_bytes < 1024:
            raise ValueError("MAX_UPLOAD_SIZE_BYTES must be >= 1024")
        if self.is_production and not (self.auth_jwt_secret.strip() or self.service_api_key.strip()):
            raise ValueError("Production requires AUTH_JWT_SECRET or SERVICE_API_KEY")
        return self


settings = Settings()

