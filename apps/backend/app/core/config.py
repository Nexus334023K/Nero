from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "NERO"
    version: str = "0.1.0"
    environment: str = "development"
    backend_host: str = "localhost"
    backend_port: int = 8765
    database_url: str = "sqlite+aiosqlite:///./nero.db"
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:3000"]
    debug: bool = True

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
