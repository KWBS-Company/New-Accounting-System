from fastapi import APIRouter

from src.components.model.controllers.controller import ModelController
from src.components.model.service.service import ModelService

router = APIRouter(
    prefix="/api/models",
    tags=["Models"]
)

model_service = ModelService()
model_controller = ModelController(model_service)


@router.get("")
async def get_models():
    return await model_controller.get_models()

