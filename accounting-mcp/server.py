from fastmcp import FastMCP

mcp = FastMCP("accounting-mcp-server")

@mcp.tool()
def get_the_balance(account_id: int) -> str:
    """Look up the balance for a given account ID."""
    balances = {1: 5000, 2: 12000}
    return f"Account {account_id} balance: {balances.get(account_id, 'not found')}"

@mcp.tool
def list_transaction(start_date: str, end_date: str):
    """List of transaction for a given date range"""
    return f"Welcome to the List_transaction {start_date} to {end_date}"


if __name__ == "__main__":
    mcp.run(transport="sse",host="0.0.0.0",port=5000)