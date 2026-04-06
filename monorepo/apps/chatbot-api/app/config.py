from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", ".env.local"),
        env_file_encoding="utf-8",
    )

    app_env: str = "development"
    app_host: str = "127.0.0.1"
    app_port: int = 8001

    model_provider: str = "openai"

    openai_api_key: str = ""
    openai_chat_model: str = "gpt-4o-mini"
    openai_embed_model: str = "text-embedding-3-small"

    ollama_base_url: str = "http://127.0.0.1:11434"
    ollama_chat_model: str = "qwen2.5:14b"
    ollama_embed_model: str = "nomic-embed-text"
    ollama_timeout_seconds: int = 180

    chroma_persist_dir: str = "./chroma_data"
    chroma_collection: str = "chatbot_chunks"

    inngest_app_id: str = "chatbot_engine"
    inngest_api_base_url: str = "http://127.0.0.1:8288/v1"
    inngest_event_api_base_url: str = "http://127.0.0.1:8288/"


settings = Settings()

