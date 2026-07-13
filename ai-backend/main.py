import uvicorn
from src.utils.config import settings
from src.app import create_app

app = create_app()

## Testing 

if __name__ == '__main__':
    port = settings.APP_PORT
    env = (settings.NODE_ENV or "development").upper()

    print(f"{env} SERVER IS RUNNING ON PORT {port}")

    uvicorn.run(
        "main:app",
        host="localhost",
        port=port,
        reload=True,
    )