import httpx


API_URL = "http://localhost:3001/api/v1"
API_KEY = "apikey4mcp"

HEADERS = {
    "x-api-key": API_KEY,
    "Content-Type": "application/json",
}


async def get_balance_data(key: str, value: str, customer_id: str):
    body = {
        "actionType": "get_account_balance",
        "customerId": customer_id,
        "key": key,
        "value": value,
        "filters": {},
    }

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{API_URL}/mcp-gateway/data",
                json=body,
                headers=HEADERS,
            )
            response.raise_for_status()
            return response.json()
    except httpx.HTTPError:
        return None


async def list_accounts_data(key: str, value: str, customer_id: str):
    body = {
        "actionType": "list_account",
        "customerId": customer_id,
        "key": key,
        "value": value,
        "filters": {},
    }

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{API_URL}/mcp-gateway/data",
                json=body,
                headers=HEADERS,
            )
            response.raise_for_status()
            return response.json()
    except httpx.HTTPError:
        return None


async def get_account_detail_data(
    key: str, value: str, customer_id: str, filters: dict = None
):
    body = {
        "actionType": "get_account_detail",
        "customerId": customer_id,
        "key": key,
        "value": value,
        "filters": filters or {},
    }

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{API_URL}/mcp-gateway/data",
                json=body,
                headers=HEADERS,
            )
            response.raise_for_status()
            return response.json()
    except httpx.HTTPError:
        return None
