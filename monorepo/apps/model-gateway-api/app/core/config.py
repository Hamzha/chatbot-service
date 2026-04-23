from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


PROJECT_ROOT = Path(__file__).resolve().parents[2]
ENV_FILE = PROJECT_ROOT / ".env"


class Settings(BaseSettings):
    app_name: str = "Model Gateway API"
    app_env: str = "development"
    app_version: str = "0.1.0"
    api_prefix: str = "/api"
    open_router_api_key: str = ""
    default_model: str = "openai/gpt-oss-120b:free"

    model_config = SettingsConfigDict(env_file=str(ENV_FILE), env_file_encoding="utf-8")


settings = Settings()


FREE_MODELS = [
    "openai/gpt-oss-120b:free",
    "openai/gpt-oss-20b:free",
    "google/gemma-3n-2b-it:free",
    "google/gemma-3n-4b-it:free",
]
