from src.utils.config import settings
import httpx

class ModelService:
    async def get_models(self):
        url = f"{settings.OLLAMA_BASE_URL}/api/tags"
        print("Calling Ollama at:", url)  # debug

        async with httpx.AsyncClient() as client:
            response = await client.get(url)
            response.raise_for_status()

            data = response.json()
            # print("Raw Ollama response:", data)  # debug


            models = [
                {"name": model["name"]}
                for model in data.get("models", [])
            ]

            return models