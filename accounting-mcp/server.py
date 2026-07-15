"""
Python equivalent of server.ts — FastMCP server exposing the calculator
and accounting tools.

Matches your existing accounting-mcp pattern (FastMCP-based tool server).
Run with:  fastmcp run mcp_server.py:mcp
       or:  python mcp_server.py   (uses stdio transport, like the original)
"""

import logging
from fastmcp import FastMCP
from mcp_gateways_client import get_account_detail, get_balance, list_accounts
logger = logging.getLogger(__name__)

mcp = FastMCP("Accounting Mcp")


def _format_accounts_for_llm(accounts) -> str:
    """
    The gateway returns each account as a dict that includes a `balance` field
    (e.g. opening balance) alongside `name`, `code`, `id`, etc. Returning the
    raw `str(accounts)` blob to the LLM caused it to latch onto whichever
    balance number it saw first and reply with "balance is 1000" instead of
    listing the accounts the user actually asked for.

    We project the response down to name + code (and id as a tie-breaker when
    names repeat) so the model gets a clean, focused list. The balance is
    intentionally stripped here — use the get_balance tool if the user asks
    about a specific account's balance.
    """
    # Normalize: the gateway may return a list, a dict, or a wrapped object.
    items = accounts
    if isinstance(items, dict):
        # Common wrapper shapes: {"data": [...]}, {"accounts": [...]}, or
        # a single-account dict we still want to surface.
        for k in ("data", "accounts", "items", "results"):
            if isinstance(items.get(k), list):
                items = items[k]
                break
        else:
            items = [items]

    if not isinstance(items, list) or not items:
        return "No accounts found for this company."

    lines: list[str] = []
    for i, acc in enumerate(items, start=1):
        if not isinstance(acc, dict):
            lines.append(f"{i}. {acc}")
            continue
        name = acc.get("name") or acc.get("accountName") or acc.get("displayName")
        code = acc.get("code") or acc.get("accountCode")
        acc_id = acc.get("id") or acc.get("accountId")

        if name and code:
            lines.append(f"{i}. {name} (code: {code})")
        elif name:
            lines.append(f"{i}. {name}")
        elif code:
            lines.append(f"{i}. Account {code}")
        elif acc_id:
            lines.append(f"{i}. Account {acc_id}")
        else:
            lines.append(f"{i}. (unnamed account)")

    return "\n".join(lines)


# ---------- list_accounts ----------
# Only one tool exposed for now — keeps the LLM tool schema small and
# responses fast. The other two are kept in mcp_gateways_client and can be
# re-enabled by uncommenting their blocks below.
@mcp.tool(
    name="list_accounts",
    description="List all accounts for the current company. Call this whenever the user asks to see, list, show, or get accounts.",
)
async def list_accounts_tool(
    customer_id: str,
    key: str = "accounts",
    value: str = "all",
) -> str:
    """
    customer_id: The company/customer id (server-injected, not filled by the LLM).
    key: Always 'accounts' (default — you usually don't need to set this).
    value: Always 'all' (default — you usually don't need to set this).
    """
    accounts = await list_accounts(key, value, customer_id)
    return _format_accounts_for_llm(accounts)


if __name__ == "__main__":
    mcp.run(transport="sse", host="0.0.0.0", port=5001)