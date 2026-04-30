from fastapi import FastAPI,Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager

from src.utils.database import engine, Base
from src.utils.logger import ActivityLogMiddleware

# Import all routers
from src.components.accounts.controllers.ledger_head_type_controller import router as ledger_head_type_router


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
    app.include_router(ledger_head_type_router, prefix="/api/ledgerheadtypes", tags=["LedgerHeadType"])

    @app.get("/api", tags=["App Healthcheck"])
    def healthCheck():
        return {"message": "App is running"}

    return app
