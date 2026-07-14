from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    # App
    APP_PORT: int = 2050
    NODE_ENV: str = "development"

    # Database
    DB_HOST: str = ""
    DB_DATABASE: str = ""
    DB_PORT: int = 5432
    DB_USERNAME: str = ""
    DB_PASSWORD: str = ""

    model_config = SettingsConfigDict(
        env_file=".env.local",
        env_file_encoding="utf-8",
    )

    ## ollama Api key
    OLLAMA_BASE_URL:str  = "http://localhost:11434"
    DEFAULT_MODEL: str = "qwen2.5:14b"



# single instance - import this everywhere
settings = Settings()