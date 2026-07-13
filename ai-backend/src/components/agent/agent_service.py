import os
import re
import logging
import asyncio
from contextvars import ContextVar

from llama_index.tools.mcp import BasicMCPClient, McpToolSpec
from llama_index.llms.ollama import Ollama
from llama_index.core.agent.workflow import FunctionAgent
from llama_index.core.workflow import Context
from llama_index.core.tools.function_tool import FunctionTool
from llama_index.core.tools.types import ToolMetadata

logger = logging.getLogger(__name__)

MCP_URL = os.getenv("MCP_SERVER_URL", "http://127.0.0.1:5000/sse")
DEFAULT_MODEL = os.getenv("DEFAULT_MODEL", "qwen2.5:7b")

REFUSAL_MESSAGE = "I can only help with accounting-related questions."

# Active session's customer (company) id. Set by `chat()` for the duration of
# an agent run so every MCP tool call automatically forwards it to the
# accounting backend. The LLM never sees or supplies this value.
_active_customer_id: ContextVar[str] = ContextVar("active_customer_id", default="")

SYSTEM_PROMPT = f"""You are an AI accounting assistant for a business.

SCOPE — what counts as an accounting question
You answer accounting questions in two flavors:

1. CONCEPTUAL (answer from your training, NO tool call):
   definitions, explanations, formulas, accounting standards, how-to
   guidance. Examples: "what is an asset?", "explain double-entry
   bookkeeping", "how is depreciation calculated?", "what is the
   difference between accrual and cash basis?".

2. DATA (call a tool to fetch the answer):
   questions about THIS company's numbers — balances, ledgers, trial
   balance, profit and loss, vouchers, invoices, fiscal periods, taxes,
   reconciliation, specific accounts. Examples: "what is my cash balance?",
   "show the trial balance for Q1", "list invoices for vendor X".

If a question is ambiguous but COULD be accounting, treat it as accounting
and try to help.

RESPONSE STYLE
- Keep answers short and sweet — aim for 20 words or fewer.
- Be direct. No greetings, no restating the question, no closing pleasantries.
- Use bullet points or a single short sentence when listing items.

OUT-OF-SCOPE BEHAVIOR
- Only refuse when the question is clearly NOT about accounting — e.g.,
  weather, jokes, recipes, sports, politics, programming tasks,
  translations, general chitchat. For these, respond with EXACTLY this
  sentence and nothing else:
  "{REFUSAL_MESSAGE}"
- Do not add greetings, follow-up questions, or explanations when refusing.

TOOL USAGE
- Call the provided accounting tools only for DATA questions (flavor 2
  above). For CONCEPTUAL questions (flavor 1), answer directly.
- The customer's company id is automatically attached to every tool call by
  the system. Do not ask the user for a customer/company id — there is no
  parameter for it in the tools.
- Never invent numbers, balances, dates, or account names. If a tool call
  returns no result, say you could not find the data.
"""

_OFF_TOPIC_PATTERNS = [
    r"\bweather\b", r"\btemperature\b", r"\bforecast\b",
    r"\bjoke\b", r"\bfunny\b", r"\bmeme\b",
    r"\bpoem\b", r"\bhaiku\b", r"\bsong\b", r"\brhyme\b",
    r"\brecipe\b", r"\bcook\b", r"\bingredients?\b",
    r"\bsports?\b", r"\bfootball\b", r"\bcricket\b", r"\bbasketball\b",
    r"\bmovie\b", r"\bfilm\b", r"\bactor\b", r"\bactress\b",
    r"\bcelebrity\b", r"\bpresident\b", r"\bprime minister\b",
    r"\belection\b", r"\bpolitics\b",
    r"\bvideo game\b", r"\bgaming\b", r"\bgame of thrones\b",
    r"\blove\b", r"\bdating\b", r"\brelationship\b",
    r"\bwho is\b", r"\bwhat is the capital\b",
    r"\btell me about (yourself|you)\b",
    r"\bwrite (a|an) (story|essay|novel|poem)\b",
    r"\btranslate\b",
    r"\bhello\b", r"\bhi there\b", r"\bhey there\b",
]

_OFF_TOPIC_RE = re.compile("|".join(_OFF_TOPIC_PATTERNS), re.IGNORECASE)


def _with_customer_id(tool: FunctionTool) -> FunctionTool:
    """
    Wrap an MCP tool so the active session's `customer_id` (set by the
    chat controller) is automatically forwarded as the `customer_id`
    argument. The LLM never has to supply it.
    """
    original = tool.async_fn

    async def wrapped(**kwargs):
        cid = _active_customer_id.get()
        if not cid:
            raise RuntimeError(
                "No active customer_id for this session — chat controller "
                "must set it before invoking the agent."
            )
        # Force-overwrite so the LLM cannot inject a different value.
        kwargs["customer_id"] = cid
        return await original(**kwargs)

    # Build a shallow copy with the wrapped fn, preserving the metadata
    # that describes the tool to the LLM (so the schema stays the same).
    new_metadata = ToolMetadata(
        name=tool.metadata.name,
        description=tool.metadata.description,
        fn_schema=tool.metadata.fn_schema,
        return_direct=tool.metadata.return_direct,
    )
    return FunctionTool.from_defaults(
        async_fn=wrapped,
        tool_metadata=new_metadata,
        partial_params=tool.partial_params or {},
    )


class AgentService:
    def __init__(self):
        self._agents: dict[str, FunctionAgent] = {}
        self._agents_lock = asyncio.Lock()

        # # Cache Context per session, so concurrent users never share
        # # conversation state. Keyed by session_id passed from the caller.
        self._contexts: dict[str, Context] = {}
        self._contexts_lock = asyncio.Lock()

        self._mcp_clients: dict[str, BasicMCPClient] = {}
        self._mcp_tool_specs: dict[str, McpToolSpec] = {}
        self._mcp_lock = asyncio.Lock()

    async def _get_mcp_tool_spec(self, url: str) -> McpToolSpec:
        if url in self._mcp_tool_specs:
            return self._mcp_tool_specs[url]

        async with self._mcp_lock:
            if url in self._mcp_tool_specs:
                return self._mcp_tool_specs[url]

            client = BasicMCPClient(url)
            self._mcp_clients[url] = client
            spec = McpToolSpec(client=client)
            self._mcp_tool_specs[url] = spec
            return spec

    async def _get_agent(self, model: str) -> FunctionAgent:
        if model in self._agents:
            return self._agents[model]

        async with self._agents_lock:
            if model in self._agents:
                return self._agents[model]


            last_exc: Exception | None = None
            for attempt, delay in enumerate((0.0, 1.0, 2.0), start=1):
                if delay:
                    await asyncio.sleep(delay)
                try:
                    tool_spec = await self._get_mcp_tool_spec(MCP_URL)
                    raw_tools = await tool_spec.to_tool_list_async()
                    # Wrap each MCP tool so the active session's
                    # customer_id is auto-injected on every call.
                    tools = [_with_customer_id(t) for t in raw_tools]
                    break
                except Exception as e:
                    last_exc = e
                    logger.warning(
                        "MCP tool list attempt %d/3 failed: %s", attempt, e
                    )
            else:  # all retries exhausted
                raise RuntimeError(
                    f"Could not load MCP tools from {MCP_URL} after 3 attempts"
                ) from last_exc

            llm = Ollama(model=model,request_timeout=300)

            agent = FunctionAgent(llm=llm,tools=tools,system_prompt=SYSTEM_PROMPT)

            self._agents[model] = agent
            return agent

    async def _get_context(self, session_id: str, agent: FunctionAgent) -> Context:
        if session_id in self._contexts:
            return self._contexts[session_id]

        async with self._contexts_lock:
            if session_id in self._contexts:
                return self._contexts[session_id]

            ctx = Context(agent)
            self._contexts[session_id] = ctx
            return ctx

    @staticmethod
    def _is_accounting_question(message: str) -> bool:
        """
        Deterministic pre-filter for obviously off-topic questions.

        Returns True if the question looks accounting-related (or ambiguous
        enough to let the LLM decide), False if it is clearly off-topic.
        """
        if not message or not message.strip():
            return False
        return not _OFF_TOPIC_RE.search(message)

    async def chat(
        self,
        message: str,
        model: str = None,
        session_id: str = None,
        customer_id: str = None,
    ):
        model = model or DEFAULT_MODEL

        if not session_id:
            yield {
                "model": model,
                "message": {"role": "assistant", "content": ""},
                "done": True,
                "error": "session_id is required for agent chat",
            }
            return

        if not customer_id:
            yield {
                "model": model,
                "message": {"role": "assistant", "content": ""},
                "done": True,
                "error": "customer_id is required for agent chat",
            }
            return

        # Pre-filter: short-circuit obvious off-topic questions without
        # even loading the agent or hitting Ollama.
        if not self._is_accounting_question(message):
            yield {
                "model": model,
                "message": {"role": "assistant", "content": REFUSAL_MESSAGE},
                "done": True,
                "refused": True,
            }
            return

        # Bind the active customer id for the duration of this agent run so
        # the wrapped MCP tools forward it to the accounting backend.
        token = _active_customer_id.set(customer_id)
        try:
            try:
                agent = await self._get_agent(model)
                ctx = await self._get_context(session_id, agent)

                handler = agent.run(user_msg=message,ctx=ctx)

                async for event in handler.stream_events():

                    # Only stream text from AgentStream events
                    if type(event).__name__ == "AgentStream":
                        if not event.delta:
                            continue

                        yield {
                            "model": model,
                            "message": {
                                "role": "assistant",
                                "content": event.delta,
                            },
                            "done": False,
                        }

                # Wait for the workflow to finish
                await handler

                yield {
                    "model": model,
                    "message": {
                        "role": "assistant",
                        "content": "",
                    },
                    "done": True,
                }

            except Exception as e:
                logger.exception("Agent chat failed for session %s", session_id)
                yield {
                    "model": model,
                    "message": {"role": "assistant", "content": ""},
                    "done": True,
                    "error": str(e),
                }
        finally:
            _active_customer_id.reset(token)


agent_service = AgentService()
