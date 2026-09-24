import os
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    PROJECT_NAME: str = "ComfyAir API"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"

    PORT: int = 8000
    HOST: str = "0.0.0.0"

    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_KEY: str = os.getenv("SUPABASE_KEY", "")
    OPENWEATHER_API_KEY: str = os.getenv("OPENWEATHER_API_KEY", "")

    class Config:
        env_file = ".env"


settings = Settings()
