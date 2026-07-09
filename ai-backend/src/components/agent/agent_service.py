import os

from llama_index.tools.mcp import BasicMCPClient, McpToolSpec
from llama_index.llms.ollama import Ollama
from llama_index.core.agent.workflow import FunctionAgent
from llama_index.core.workflow import Context

MCP_URL = os.getenv("MCP_SERVER_URL", "http://127.0.0.1:5000/sse")
DEFAULT_MODEL = os.getenv("DEFAULT_MODEL", "qwen2.5:7b")

SYSTEM_PROMPT = """
You are an AI accounting assistant.
Use the provided tools whenever needed to answer the user's questions.
"""


class AgentService:
    def __init__(self):
        self.mcp_client = BasicMCPClient(MCP_URL)
        self.tool_spec = McpToolSpec(client=self.mcp_client)

        self._agent = None
        self._ctx = None

    async def _ensure(self, model=None):
        if self._agent is None:
            tools = await self.tool_spec.to_tool_list_async()

            llm = Ollama(
                model=model or DEFAULT_MODEL,
                request_timeout=300,
            )

            self._agent = FunctionAgent(
                llm=llm,
                tools=tools,
                system_prompt=SYSTEM_PROMPT,
            )

            self._ctx = Context(self._agent)

    async def chat(self, message: str, model: str = None):
        await self._ensure(model)

        handler = self._agent.run(
            user_msg=message,
            ctx=self._ctx,
        )

        async for event in handler.stream_events():

            # Only stream text from AgentStream events
            if type(event).__name__ == "AgentStream":

                # Skip empty chunks
                if not event.delta:
                    continue

                yield {
                    "model": model or DEFAULT_MODEL,
                    "message": {
                        "role": "assistant",
                        "content": event.delta,
                    },
                    "done": False,
                }

        # Wait for the workflow to finish
        response = await handler

        yield {
            "model": model or DEFAULT_MODEL,
            "message": {
                "role": "assistant",
                "content": "",
            },
            "done": True,
        }

agent_service = AgentService()