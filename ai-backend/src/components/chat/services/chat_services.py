from src.utils.config import settings
import httpx


class ChatService:
    async def chat(self, model: str, messages: list, stream: bool = False):
        url = f"{settings.OLLAMA_BASE_URL}/api/chat"

        payload = {
            "model": model,
            "messages": messages,
            "stream": stream,
        }

        async with httpx.AsyncClient(timeout=120) as client:
            response = await client.post(url, json=payload)
            response.raise_for_status()

            data = response.json()
            from src.utils.config import settings
import httpx


class ChatService:
    async def chat(self, model: str, messages: list, stream: bool = False):
        url = f"{settings.OLLAMA_BASE_URL}/api/chat"

        payload = {
            "model": model,
            "messages": messages,
            "stream": stream,
        }
        print(payload)

        async with httpx.AsyncClient(timeout=120) as client:
            response = await client.post(url, json=payload)
            response.raise_for_status()

            data = response.json()

            return {
                "model": data.get("model"),
                "message": data.get("message", {}).get("content"),
            }
        