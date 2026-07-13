import asyncio
from llama_index.tools.mcp import BasicMCPClient, McpToolSpec
from llama_index.tools.mcp import McpToolSpec
from llama_index.core.agent.workflow import FunctionAgent
from llama_index.llms.ollama import Ollama
from llama_index.core import Settings
from llama_index.core.agent.workflow import FunctionAgent, ToolCallResult, ToolCall
from llama_index.core.workflow import Context

## importting the Model from the local
llm = Ollama(model="qwen2.5:7b", request_timeout= 300)
Settings.llm = llm


## Design the System promt
SYSTEM_PROMPT = """ 
You are the AI assistant for the tool calling

Take the User Input and give it back to the user
"""

## Helper Function

async def get_agent(tools: McpToolSpec):
    tools = await tools.to_tool_list_async()  ## Fetch all the tools for the server
    agent = FunctionAgent(
        name= 'Agent',
        description= 'Response to the user input',
        tools= tools,
        llm= llm,
        system_prompt= SYSTEM_PROMPT
    )
    return agent

## Helper Function To interact with the user
async def handle_user_message(
        message_content : str,
        agent: FunctionAgent,
        agent_context: Context,
        verbose: bool = False):
    handler = agent.run(message_content, ctx=agent_context)

    async for event in handler.stream_events():
        if verbose and type(event) == ToolCall:
            print(f"Calling tool {event.tool_name} with kwargs {event.tool_kwargs}")
        elif verbose and type(event) == ToolCallResult:
            print(f"Tool {event.tool_name} returned {event.tool_output}")

    response = await handler

    return str(response)           



async def main():

    mcp_client = BasicMCPClient("http://127.0.0.1:5000/sse")  ## Connect the Server with the url
    mcp_tool = McpToolSpec(client=mcp_client)             ## warp up the all the tools

    agent = await get_agent(mcp_tool)
    agent_context = Context(agent)

    while True:
        user_input = input("Enter your message: ")
        if user_input == "exit":
            break
        print("User: ", user_input)
        response = await handle_user_message(user_input, agent, agent_context, verbose=True)
        print("Agent: ", response)


if __name__ == "__main__":
    asyncio.run(main())