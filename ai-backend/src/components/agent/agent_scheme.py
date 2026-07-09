from pydantic import BaseModel, Field
from typing import List, Optional, Literal


class AgentMessage(BaseModel):
    role: Literal["user", "assistant", "system"] = "user"
    content: str


class AgentRequest(BaseModel):
    model: Optional[str] = Field(default=None, description="Ollama model override")
    messages: List[AgentMessage] = Field(..., description="Conversation messages")


class StreamEvent(BaseModel):
    type: Literal["delta", "message", "error"]
    content: Optional[str] = None