from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

    app_name: str = "api"
    debug: bool = False
    database_url: str = "sqlite+aiosqlite:////data/nowboard.db"

    secret_key: str

    app_base_url: str = "http://localhost:8000"

    session_ttl_seconds: int = 2592000
    rate_limit_window_seconds: int = 900
    rate_limit_max: int = 5


settings = Settings()
