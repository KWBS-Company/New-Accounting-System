from src.components.model.service.service import ModelService
from fastapi import APIRouter

class ModelController:
    def __init__(self, model_service: ModelService):
        self.model_service = model_service

    async def get_models(self):
        return await self.model_service.get_models()
    

router = APIRouter(prefix="/api/models", tags=["Models"])

model_service = ModelService()
model_controller = ModelController(model_service)


@router.get("/")
async def get_models():
    return await model_controller.get_models()