from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "NERO"
    version: str = "1.0.0"
    environment: str = "production"
    backend_host: str = "localhost"
    backend_port: int = 8765
    database_url: str = "sqlite+aiosqlite:///./nero.db"
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:3000"]
    debug: bool = True

    # AI Provider Settings
    openai_api_key: str = ""
    gemini_api_key: str = ""
    elevenlabs_api_key: str = ""
    ollama_base_url: str = "http://localhost:11434"
    active_ai_provider: str = "offline"
    default_personality_mode: str = "adaptive"

    model_config = SettingsConfigDict(
        env_file=(".env", "../.env", "../../.env"),
        extra="ignore",
    )


settings = Settings()
