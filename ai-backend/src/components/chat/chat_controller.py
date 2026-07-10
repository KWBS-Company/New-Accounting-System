from src.components.chat.chat_service import chat_service
from fastapi import APIRouter
from src.components.chat.chat_schema import ChatRequest
import json
from fastapi.responses import StreamingResponse
from src.components.agent.agent_service import agent_service


router = APIRouter(prefix="/api/chat", tags=["Chat"])

@router.post("")
async def chat(body: ChatRequest):

    model = body.get_model()
    messages = [m.model_dump() for m in body.messages]

    async def event_stream():
        if body.mode == "chat":
            async for chunk in chat_service.chat(model, messages):
                yield f"data: {json.dumps(chunk)}\n\n"

        else:

            message = body.messages[-1].content
            async for chunk in agent_service.chat(message, model):
                yield f"data: {json.dumps(chunk)}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
    )