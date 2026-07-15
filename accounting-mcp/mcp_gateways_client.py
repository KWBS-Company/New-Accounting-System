"""
Python equivalent of api.ts — client for the mcp-gateway/data endpoint.

Mirrors the original axios-based functions:
    getBalance()       -> get_balance()
    listAccounts()     -> list_accounts()
    getAccountDetail() -> get_account_detail()
"""

from typing import Any, Optional

import logging

import httpx
from pydantic_settings import BaseSettings

logger = logging.getLogger(__name__)


class MCPGatewaySettings(BaseSettings):
    """
    Pulls config from environment / .env instead of hardcoding,
    unlike the original api.ts (which hardcodes API_URL and API_KEY).
    """
    mcp_gateway_url: str = "http://localhost:3001/api/v1"
    mcp_gateway_api_key: str = "apikey4mcp"
    mcp_gateway_timeout: float = 60.0

    class Config:
        env_prefix = "MCP_"  # e.g. MCP_GATEWAY_URL, MCP_GATEWAY_API_KEY, MCP_GATEWAY_TIMEOUT


settings = MCPGatewaySettings()

HEADERS = {
    "x-api-key": settings.mcp_gateway_api_key,
    "Content-Type": "application/json",
}


async def _post_to_gateway(body: dict[str, Any]) -> Optional[dict[str, Any]]:
    """
    Shared POST logic — equivalent of the repeated axios.post(...) + try/catch
    block in each of the three TS functions.
    """
    url = f"{settings.mcp_gateway_url}/mcp-gateway/data"

    timeout = httpx.Timeout(settings.mcp_gateway_timeout, connect=10.0)
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                url, json=body, headers=HEADERS, timeout=timeout
            )
            response.raise_for_status()
            data = response.json()
            logger.info(
                "Gateway POST %s actionType=%s customerId=%s -> %s",
                url, body.get("actionType"), body.get("customerId"),
                # Truncate to keep logs readable.
                str(data)[:500],
            )
            return data
    except httpx.HTTPError as e:
        # Log so timeouts / 5xx aren't invisible to the user.
        logger.warning(
            "Gateway POST %s failed: %s (timeout=%ss)",
            url, e, settings.mcp_gateway_timeout,
        )
        return None
    except ValueError as e:
        # response.json() raises ValueError on non-JSON bodies (e.g. an HTML
        # 502 from a reverse proxy). Treat as a failed call.
        logger.warning("Gateway POST %s returned non-JSON body: %s", url, e)
        return None


async def get_balance(key: str, value: str, customer_id: str) -> Optional[dict[str, Any]]:
    """Equivalent of getBalance()."""
    body = {
        "actionType": "get_account_balance",
        "customerId": customer_id,
        "key": key,
        "value": value,
        "filters": {},
    }
    return await _post_to_gateway(body)


async def list_accounts(key: str, value: str, customer_id: str) -> Optional[dict[str, Any]]:
    """Equivalent of listAccounts()."""
    body = {
        "actionType": "list_account",
        "customerId": customer_id,
        "key": key,
        "value": value,
        "filters": {},
    }
    return await _post_to_gateway(body)


async def get_account_detail(
    key: str,
    value: str,
    customer_id: str,
    filters: Optional[dict[str, Any]] = None,
) -> Optional[dict[str, Any]]:
    """Equivalent of getAccountDetail()."""
    body = {
        "actionType": "get_account_detail",
        "customerId": customer_id,
        "key": key,
        "value": value,
        "filters": filters or {},
    }
    return await _post_to_gateway(body)