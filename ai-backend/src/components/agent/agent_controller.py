from fastapi import APIRouter
from fastapi.responses import StreamingResponse
import json
from .agent_service import agent_service
from .agent_scheme import AgentRequest

router = APIRouter(prefix="/api/agent", tags=["Agent"])


@router.post("/chat")
async def chat(body: AgentRequest):
    message = body.messages[-1].content

    async def event_stream():
        async for ev in agent_service.chat(message, model=body.model):
            yield f"data: {json.dumps(ev, default=str)}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")