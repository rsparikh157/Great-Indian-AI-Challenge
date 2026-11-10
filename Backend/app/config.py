from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    app_name: str = "PataBatao API"
    environment: str = "development"
    cors_origins: str = "http://localhost:4200"
    google_maps_server_key: str = ""
    llm_base_url: str = ""
    llm_api_key: str = ""
    llm_model: str = ""
    gnani_transcribe_url: str = ""
    gnani_api_key: str = ""
    gnani_audio_field: str = "audio"
    max_audio_mb: int = 15
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def allowed_origins(self) -> list[str]:
        return [x.strip() for x in self.cors_origins.split(",") if x.strip()]

settings = Settings()
