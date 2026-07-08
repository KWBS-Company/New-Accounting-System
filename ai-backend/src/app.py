from fastapi import FastAPI

from src.components.model.model_controller import router as model_router
from src.components.chat.chat_controller import router as chat_router


def create_app():
    app = FastAPI(
        title="AI Backend",
        description="The AI Backend API",
    )

    from fastapi import APIRouter


    @app.get("/health", tags=["Health"])
    async def health_check():
        return {
            "message": "App is running"
        }

    # Model APIs
    app.include_router(model_router)

    # Chat api
    app.include_router(chat_router)

    return app