from pydantic import BaseModel, Field
from typing import List, Optional, Literal
from src.utils.config import settings


class UserInfo(BaseModel):
    email: str
    companyId: str
    companyName: str
    fullName: str


class Message(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    model: Optional[str] = None
    messages: List[Message]
    stream: bool = True
    userInfo: UserInfo

    def get_model(self) -> str:
        return self.model or settings.DEFAULT_MODEL

    def session_id(self) -> str:
        return f"{self.userInfo.companyId}:{self.userInfo.email}"
