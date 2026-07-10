from src.utils.config import settings
import httpx
import json

SYSTEM_PROMPT = """
You are an AI Accounting Assistant.

Answer ONLY accounting-related questions.
...
"""

class ChatService:
    async def chat(self, model, messages):

        final_messages = [
            {
                "role": "system",
                "content": SYSTEM_PROMPT,
            },
            *messages,
        ]
        
        payload = {
            "model": model,
            "messages": final_messages,
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

                    yield {
                        "model": chunk["model"],
                        "message": chunk["message"],
                        "done": chunk["done"],
                    }
                            

chat_service = ChatService()