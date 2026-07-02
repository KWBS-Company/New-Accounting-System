from fastapi import FastAPI
from src.api.health import router as health_router


def create_app():
    
    app = FastAPI(
        description="The Accounting API description",
        title="AI Backend"
        )

    app.include_router(health_router)

    return app