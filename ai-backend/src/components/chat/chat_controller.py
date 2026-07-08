from src.components.chat.chat_service import chat_service
from fastapi import APIRouter
from src.components.chat.chat_schema import ChatRequest


router = APIRouter(prefix="/api/chat", tags=["Chat"])

@router.post("")
async def chat(body: ChatRequest):
    model = body.get_model() 
    messages = [msg.model_dump() for msg in body.messages]
    async for token in chat_service.chat(model, messages):
       yield token
    # return await chat_controller.chat(model, messages, body.stream)
    