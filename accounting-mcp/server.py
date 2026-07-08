from fastmcp import FastMCP
import services.accounting_service as accounting_service

mcp = FastMCP('accounting-mcp-server')

@mcp.tool
def get_account_balance(account_id: int):
    """
    Get the balance of the specific account
    """
    result = accounting_service.get_account_balance(account_id)
    return result

@mcp.tool
def list_transaction(start_date: str, end_date: str):
    """ List of transaction for a given data range """
    result = accounting_service.list_transactions(start_date, end_date)
    return result


if __name__ == '__main__':
    mcp.run()