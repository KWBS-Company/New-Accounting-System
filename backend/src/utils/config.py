from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    # App
    APP_PORT: int = 3000
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


# single instance - import this everywhere
settings = Settings()