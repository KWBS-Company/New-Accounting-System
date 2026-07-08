import asyncio
from fastmcp import Client

async def main():
    client = Client("server.py")

    async with client:
        tools = await client.list_tools()
        for t in tools:
            print(t.name, "-", t.description)

        result = await client.call_tool("get_account_balance", {"account_id": 12345})
        print(result)

if __name__ == "__main__":
    asyncio.run(main())