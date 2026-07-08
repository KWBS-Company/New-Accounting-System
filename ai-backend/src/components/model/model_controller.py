from src.components.model.model_service import model_service
from fastapi import APIRouter

router = APIRouter(prefix="/api/models", tags=["Models"])


@router.get("/")
async def get_models():
    return await model_service.get_models()