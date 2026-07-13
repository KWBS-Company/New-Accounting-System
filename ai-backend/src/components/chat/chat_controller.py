from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from src.components.chat.chat_schema import ChatRequest
from src.components.agent.agent_service import agent_service
import json
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/chat", tags=["Chat"])


@router.post("")
async def chat(body: ChatRequest):
    """
    Single execution path: every request goes through the agent service,
    which has access to MCP tools and enforces the accounting scope.

    The legacy `mode` field on ChatRequest is accepted for backward
    compatibility with the nodeapi mapper but is no longer consulted.
    """

    model = body.get_model()
    message = body.messages[-1].content
    session_id = body.session_id()
    customer_id = body.userInfo.companyId

    if session_id is None or not customer_id:
        async def error_stream():
            yield f"data: {json.dumps({'error': 'userInfo.companyId is required', 'done': True})}\n\n"
        return StreamingResponse(error_stream(), media_type="text/event-stream")

    async def event_stream():
        try:
            async for chunk in agent_service.chat(
                message,
                model,
                session_id=session_id,
                customer_id=customer_id,
            ):
                yield f"data: {json.dumps(chunk)}\n\n"

        except Exception as e:
            logger.exception("Unhandled error in chat stream")
            yield f"data: {json.dumps({'error': str(e), 'done': True})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
    )
