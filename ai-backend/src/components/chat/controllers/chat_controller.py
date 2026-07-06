from src.components.chat.services.chat_services import ChatService


class ChatController:
    def __init__(self, chat_service: ChatService):
        self.chat_service = chat_service

    async def chat(self, model: str, messages: list, stream: bool = False):
        return await self.chat_service.chat(model, messages, stream)