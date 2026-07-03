from fastapi import APIRouter
from src.components.chat.controllers.chat_controller import ChatController
from src.components.chat.services.chat_services import ChatService
from src.components.chat.schema import ChatRequest

router = APIRouter(prefix="/api/chat", tags=["Chat"])

chat_service = ChatService()
chat_controller = ChatController(chat_service)


@router.post("")
async def chat(body: ChatRequest):
    model = body.get_model() 
    messages = [msg.model_dump() for msg in body.messages]
    async for token in chat_service.chat(model, messages):
       yield token
    # return await chat_controller.chat(model, messages, body.stream)