from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI

from src.components.model.model_controller import router as model_router
from src.components.chat.chat_controller import router as chat_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    app.state.http_client = httpx.AsyncClient(timeout=None)

    yield

    # Shutdown
    await app.state.http_client.aclose()


def create_app():
    app = FastAPI(
        title="AI Backend",
        description="The AI Backend API",
        lifespan=lifespan,
    )

    @app.get("/health", tags=["Health"])
    async def health_check():
        return {
            "message": "App is running"
        }

    # Model APIs
    app.include_router(model_router)

    # Chat api (single path — agent + MCP tools, with accounting scope)
    app.include_router(chat_router)

    return app
