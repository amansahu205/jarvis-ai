from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file='.env', extra='ignore')

    APP_ENV: str = 'development'
    APP_NAME: str = 'JarvisAI'
    DEBUG: bool = False
    DATABASE_URL: str
    JWT_SECRET: str
    AGENT_TOKEN_SECRET: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480
    ANTHROPIC_API_KEY: str = ''
    GEMINI_API_KEY: str = ''
    PINECONE_API_KEY: str = ''
    PINECONE_INDEX_NAME: str = 'jarvis-compliance'
    OPENWEATHER_API_KEY: str = ''
    ELEVENLABS_API_KEY: str = ''
    ELEVENLABS_AGENT_ID: str = ''
    TWILIO_ACCOUNT_SID: str = ''
    TWILIO_AUTH_TOKEN: str = ''
    TWILIO_PHONE_NUMBER: str = ''
    TWILIO_STUDIO_FLOW_SID: str = ''
    RP_PHONE_NUMBER: str = ''
    FRONTEND_URL: str = 'http://localhost:3000'

@lru_cache
def get_settings() -> Settings:
    return Settings()

settings = get_settings()



