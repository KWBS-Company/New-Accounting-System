from src.utils.config import settings
import httpx
import json



class ChatService:

    async def chat(self, model, messages):

        payload = {
            "model": model,
            "messages": messages,
            "stream": True,
        }

        async with httpx.AsyncClient(timeout=None) as client:
            async with client.stream(
                "POST",
                f"{settings.OLLAMA_BASE_URL}/api/chat",
                json=payload,
            ) as response:

                response.raise_for_status()

                async for line in response.aiter_lines():
                    if not line:
                        continue

                    chunk = json.loads(line)

                    yield chunk
        