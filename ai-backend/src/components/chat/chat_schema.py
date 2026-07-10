from pydantic import BaseModel
from typing import List, Optional
from src.utils.config import settings
from typing import Literal


class Message(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    model: Optional[str] = None
    messages: List[Message]
    stream: bool = True

    mode: Literal["chat", "agent"] = "chat"

    def get_model(self):
        return self.model or settings.DEFAULT_MODEL