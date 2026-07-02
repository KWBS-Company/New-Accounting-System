from pydantic import BaseModel
from typing import List, Optional
from src.utils.config import settings


class Message(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    model: Optional[str] = None
    messages: List[Message]
    stream: bool = False

    def get_model(self) -> str:
        resolved = self.model or settings.DEFAULT_MODEL
        return resolved