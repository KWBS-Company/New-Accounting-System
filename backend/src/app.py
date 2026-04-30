from fastapi import FastAPI,Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager

from src.utils.database import engine, Base
from src.utils.logger import ActivityLogMiddleware

# Import all routers
# from src.components.auth.auth_controller import router as auth_router
# from src.components.user.user_controller import router as user_router
# from src.components.linkedin.linkedin_controller import router as linkedin_router
# from src.components.google.google_controller import router as google_router
# from src.components.chat.chat_controller import router as chat_router
# from src.components.job.job_profile_controller import router as job_profile_router
# from src.components.contact_us.contact_us_controller import router as contact_us_router
# from src.components.event.event_controller import router as event_router
# from src.components.stripe.stripe_controller import router as stripe_router
# from src.components.stripe.stripe_webhook_controller import router as stripe_webhook_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    # Shutdown
    await engine.dispose()


def create_app() -> FastAPI:
    app = FastAPI(
        title="Accounting API",
        description="The Accounting API description",
        version="1.0.0",
        docs_url="/docs",
        lifespan=lifespan,
    )

     # ✅ Handle all unhandled exceptions
    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "message": "Internal Server Error",
                # "detail": str(exc),  # remove in production if needed
            },
        )

    # CORS - matching NestJS config
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173"],
        allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
        allow_credentials=True,
        allow_headers=["Content-Type", "Authorization", "ngrok-skip-browser-warning"],
        expose_headers=["Content-Disposition", "Content-Length", "Content-Type"],
    )

    # Activity log middleware
    app.add_middleware(ActivityLogMiddleware)

    # Mount routers with /api prefix
    # app.include_router(auth_router, prefix="/api/auth", tags=["Auth"])
    # app.include_router(user_router, prefix="/api/users", tags=["Users"])

    @app.get("/api", tags=["App Healthcheck"])
    def healthCheck():
        return {"message": "App is running"}

    return app
