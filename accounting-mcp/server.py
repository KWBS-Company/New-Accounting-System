from fastmcp import FastMCP
from pydantic import Field
import json
from api import get_balance_data, get_account_detail_data, list_accounts_data


mcp = FastMCP("accounting-mcp")

@mcp.tool(
    name="get-balance",
    title="Get Balance",
    description=(
        "Get balance by accountName or accountCode or accountId or id or name "
        "or code. customer_id is the calling company's id and MUST be passed "
        "in from the chat session — never invent one."
    ),
)
async def get_balance(
    customer_id: str = Field(
        description=(
            "The calling company's UUID. The chat backend injects this "
            "automatically; do not ask the user for it."
        )
    ),
    key: str = Field(
        description="Key of accountName or name or code or accountCode or accountId or id"
    ),
    value: str = Field(
        description="Value of accountName or name or code or accountCode or accountId or id"
    ),
) -> str:
    balance = await get_balance_data(key, value, customer_id)
    if not balance:
        return "balance not found"
    return json.dumps(balance)


@mcp.tool(
    name="list_accounts",
    title="List accounts",
    description="List accounts. customer_id is the calling company's id.",
)
async def list_accounts(
    customer_id: str = Field(
        description=(
            "The calling company's UUID. The chat backend injects this "
            "automatically; do not ask the user for it."
        )
    ),
    key: str = Field(description="always put accounts value"),
    value: str = Field(description="always put all value"),
) -> str:
    accounts = await list_accounts_data(key, value, customer_id)
    if accounts is not None and len(accounts) == 0:
        return "account list not found"
    return json.dumps(accounts)


@mcp.tool(
    name="get_account_details",
    title="Get account detail",
    description=(
        "Get account by accountName or accountCode or accountId or id or name "
        "or code with option of showChild. customer_id is the calling "
        "company's id."
    ),
)
async def get_account_details(
    customer_id: str = Field(
        description=(
            "The calling company's UUID. The chat backend injects this "
            "automatically; do not ask the user for it."
        )
    ),
    key: str = Field(description="always put accounts value"),
    value: str = Field(description="always put all value"),
    show_child: bool = Field(
        description="put true if user wants to list children otherwise false"
    ),
) -> str:
    filters = {"showChild": show_child}
    account = await get_account_detail_data(key, value, customer_id, filters)
    if not account:
        return "account not found"
    return json.dumps(account)

if __name__ == "__main__":
    mcp.run(transport="sse",host="0.0.0.0",port=5000)
