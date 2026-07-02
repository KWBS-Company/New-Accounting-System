from fastapi import FastAPI

from src.api.health import router as health_router
from src.api.model import router as model_router
from src.api.chat import router as chat_router


def create_app():
    app = FastAPI(
        title="AI Backend",
        description="The AI Backend API",
    )

    # Health APIs
    app.include_router(health_router)

    # Model APIs
    app.include_router(model_router)

    # Chat api
    app.include_router(chat_router)

    return app