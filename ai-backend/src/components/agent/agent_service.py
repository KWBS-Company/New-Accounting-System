import os
import re
import logging
import asyncio

from pydantic import create_model
from llama_index.tools.mcp import BasicMCPClient, McpToolSpec
from llama_index.llms.ollama import Ollama
from llama_index.core.agent.workflow import FunctionAgent
from llama_index.core.tools import FunctionTool
from llama_index.core.workflow import Context

logger = logging.getLogger(__name__)

MCP_URL = os.getenv("MCP_SERVER_URL", "http://127.0.0.1:5001/sse")
DEFAULT_MODEL = os.getenv("DEFAULT_MODEL", "qwen2.5:7b")

REFUSAL_MESSAGE = "I can only help with accounting-related questions."

SYSTEM_PROMPT = f"""You are an AI accounting assistant for a business.

Your job is to answer questions about accounting, the user's books, accounts,
balances, ledgers, vouchers, invoices, taxes, and related financial data.

ACCOUNTING QUESTIONS (answer these):
- Conceptual: definitions, explanations, formulas, standards, how-to
  guidance. Examples: "what is an asset?", "explain double-entry
  bookkeeping", "how is depreciation calculated?", "what is the difference
  between accrual and cash basis?".
- Data: questions about THIS company's numbers — balances, ledgers, trial
  balance, profit and loss, vouchers, invoices, fiscal periods, taxes,
  reconciliation, accounts. Examples: "what is my cash balance?",
  "show the trial balance for Q1", "list invoices for vendor X",
  "get the list of accounts", "show my accounts", "what accounts do I have?".

NOT ACCOUNTING (refuse these):
- weather, jokes, recipes, sports, politics, programming tasks, translations,
  general chitchat, questions about famous people, animals, places, things
  unrelated to accounting. For these, respond with EXACTLY this sentence and
  nothing else: "{REFUSAL_MESSAGE}"

IMPORTANT: A user asking to "list accounts", "show accounts", "get the list
of accounts", or "what accounts exist" is ALWAYS an accounting question.
Always call the list_accounts tool for that. The tool returns a clean
name + code list — report those names back, nothing else. Do NOT report
any balance, id, or other field that may appear in the raw data; if the
user wants a specific account's balance, they need to ask explicitly.

RESPONSE STYLE
- Keep answers short and sweet — aim for 20 words or fewer.
- Be direct. No greetings, no restating the question, no closing pleasantries.
- Use bullet points or a single short sentence when listing items.
- Do not add greetings, follow-up questions, or explanations when refusing.

TOOL USAGE
- Call the provided accounting tools for DATA questions. For CONCEPTUAL
  questions, answer directly without tools.
- The tool's response is the SOURCE OF TRUTH. When a tool returns a value
  (a balance, a list of accounts, a status), quote that exact value in
  your reply. Do not invent, estimate, round, or substitute a different
  number — even if the value is 0 or the list is empty. If the tool says
  "Balance is 0 USD." then say "Your balance is 0 USD." — never "0", never
  "$5000", never "approximately".
- If a tool returns no result, say you could not find the data. Do not
  fill in a plausible-looking number.
- For the list_accounts tool: report ONLY the account names (and codes
  if shown). Never quote a balance from that response, even if a number
  is visible. Balance queries require the user to name a specific account.
"""

_OFF_TOPIC_PATTERNS = [
    # Geography / people / places / things unrelated to accounting
    r"\bwho is\b", r"\bwho was\b", r"\bwho're\b", r"\bwho are\b",
    r"\bwhat is the capital\b", r"\bwhere is\b", r"\bwhen was\b",
    r"\bwhen is\b", r"\bhow old is\b", r"\bhow tall is\b",
    r"\bborn\b", r"\bdied\b", r"\bdate of birth\b",
    # Weather / time
    r"\bweather\b", r"\btemperature\b", r"\bforecast\b", r"\bclimate\b",
    r"\bhumidity\b", r"\brainfall\b", r"\bsnowfall\b",
    # Entertainment
    r"\bjoke\b", r"\bfunny\b", r"\bmeme\b",
    r"\bpoem\b", r"\bhaiku\b", r"\bsong\b", r"\brhyme\b",
    r"\brecipe\b", r"\bcook\b", r"\bingredients?\b",
    # Sports / celebrities / movies
    r"\bsports?\b", r"\bfootball\b", r"\bcricket\b", r"\bbasketball\b",
    r"\btennis\b", r"\bgolfer?\b",
    r"\bworld cup\b", r"\bchampions league\b", r"\bpremier league\b",
    r"\bMessi\b", r"\bRonaldo\b", r"\bBeyonce\b", r"\bTaylor Swift\b",
    r"\bmovie\b", r"\bfilm\b", r"\bactor\b", r"\bactress\b",
    r"\bcelebrity\b", r"\bcelebrities\b", r"\bfamous\b",
    # Politics / news
    r"\bpresident\b", r"\bprime minister\b", r"\bsenator\b", r"\bgovernor\b",
    r"\belection\b", r"\bpolitics\b", r"\bpolitical\b", r"\bgovernment of\b",
    r"\bvote\b",
    # Games / hobbies
    r"\bvideo game\b", r"\bgaming\b", r"\bgame of thrones\b", r"\bminecraft\b",
    r"\bfortnite\b", r"\bzelda\b", r"\bpokemon\b",
    # Tech / programming (not accounting-related)
    r"\bwrite (a )?code\b", r"\bwrite (a )?program\b", r"\bwrite (a )?function\b",
    r"\bwrite (a )?script\b", r"\bdebug\b", r"\bbug in my code\b",
    r"\bpython\b", r"\bjavascript\b", r"\btypescript\b", r"\brust\b", r"\bjava\b",
    r"\breact\b", r"\bnode\.?js\b", r"\bdjango\b", r"\bflask\b",
    # Translation / language
    r"\btranslate\b", r"\bin (Spanish|French|German|Hindi|Chinese|Japanese|Korean)\b",
    # Math word problems (unrelated to the books) — keep arithmetic
    # available but refuse story problems about apples / cars / etc.
    r"\bhow many apples\b", r"\bhow many cars\b", r"\bword problem\b",
]

_OFF_TOPIC_RE = re.compile("|".join(_OFF_TOPIC_PATTERNS), re.IGNORECASE)
_ACCOUNTING_KEYWORDS = [
    r"\baccount", r"\baccounts\b", r"\bbalance", r"\bbalances\b",
    r"\bledger", r"\bjournal\b", r"\bvoucher", r"\binvoice", r"\bbill",
    r"\bcredit", r"\bdebit", r"\bcreditor", r"\bdebtor",
    r"\btax\b", r"\bgst\b", r"\bvat\b", r"\bsales tax\b",
    r"\btrial balance\b", r"\bprofit\b", r"\bloss\b", r"\bP&L\b",
    r"\bincome\b", r"\bexpense", r"\bexpenses\b", r"\brevenue", r"\brevenues\b",
    r"\bcash\b", r"\bbank\b", r"\bcheque\b", r"\bcheck\b",
    r"\bpayroll\b", r"\bsalary\b", r"\bsalaries\b", r"\bwage", r"\bwages\b",
    r"\bdepreciation\b", r"\bamortiz", r"\basset", r"\bassets\b",
    r"\bliabilit", r"\bequit", r"\bcapital\b",
    r"\bfiscal\b", r"\bfinancial year\b", r"\baccounting period\b",
    r"\breconcil", r"\baudit\b", r"\bbudget\b",
    r"\bbookkeep", r"\bdouble[- ]entry\b", r"\bchart of accounts\b",
    r"\bvendor\b", r"\bclient\b", r"\bcustomer\b",
    r"\bUSD\b", r"\bEUR\b", r"\bGBP\b", r"\bNPR\b", r"\bINR\b", r"\b\$",
    r"\bpaisa\b", r"\brupee\b", r"\bdollar", r"\beuro\b",
    r"\bthis company\b", r"\bmy books\b", r"\bmy account", r"\bour account",
]

_ACCOUNTING_KEYWORD_RE = re.compile("|".join(_ACCOUNTING_KEYWORDS), re.IGNORECASE)

# Generic question opener — combined with "no accounting keyword" this is a
# reliable off-topic signal (who/what/where/when/how is X). It deliberately
# leaves out "how do I" / "how to" because those ARE valid accounting how-tos.
_QUESTION_OPENER_RE = re.compile(
    r"^\s*(who|what|where|when|why|how (old|tall|far|many|long|big))\b",
    re.IGNORECASE,
)


def _bind_customer_id(tools: list, company_id: str) -> list:
    """
    Rebuild every MCP tool so `customer_id` is injected server-side and
    completely removed from the schema the LLM sees.

    This is the actual multi-tenant boundary: the model is never given
    the parameter, never asked to fill it in, and has no way to override
    it — regardless of what it tries to pass. This also fixes small
    models unreliably omitting/hallucinating a required `customer_id`
    argument, which was causing tool calls (like list_accounts) to fail
    validation before ever reaching the gateway.
    """
    bound: list[FunctionTool] = []

    for tool in tools:
        meta = tool.metadata
        schema_cls = meta.fn_schema

        # New schema = original schema minus customer_id
        field_definitions = {
            name: (field.annotation, field)
            for name, field in schema_cls.model_fields.items()
            if name != "customer_id"
        }
        new_schema = create_model(f"{schema_cls.__name__}_Bound", **field_definitions)

        # Build a per-tool async wrapper with its OWN closure over THIS
        # tool and THIS company_id, not the loop's last values. The
        # default-arg trick (`_tool=tool, _cid=company_id`) above worked
        # for a single tool, but with multiple MCP tools registered,
        # every wrapper silently aliased to the loop's last `tool`.
        # We rewrite the loop so each iteration produces a fresh function
        # object — closing over the iteration's locals rather than the
        # loop variable.
        def _make_wrapper(_tool=tool, _cid=company_id):
            async def _call(**kwargs):
                kwargs["customer_id"] = _cid  # server-injected, always wins
                return await _tool.acall(**kwargs)
            return _call

        bound.append(
            FunctionTool.from_defaults(
                async_fn=_make_wrapper(),
                name=meta.name,
                description=meta.description,
                fn_schema=new_schema,
            )
        )
    return bound


class AgentService:
    def __init__(self):
        # Keyed by (model, company_id) so each company gets its own agent
        # with tools pre-bound to that company's id.
        self._agents: dict[tuple[str, str], FunctionAgent] = {}
        self._agents_lock = asyncio.Lock()

        # Context per session, so concurrent users never share conversation
        # state. Keyed by session_id passed from the caller.
        self._contexts: dict[str, Context] = {}
        self._contexts_lock = asyncio.Lock()

        # Raw MCP connection/spec cache — shared across all companies.
        # Tool *instances* are still generated fresh per agent build so
        # binding never leaks across tenants.
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

    async def _get_agent(self, model: str, company_id: str) -> FunctionAgent:
        cache_key = (model, company_id)
        if cache_key in self._agents:
            return self._agents[cache_key]

        async with self._agents_lock:
            if cache_key in self._agents:
                return self._agents[cache_key]

            last_exc: Exception | None = None
            for attempt, delay in enumerate((0.0, 1.0, 2.0), start=1):
                if delay:
                    await asyncio.sleep(delay)
                try:
                    tool_spec = await self._get_mcp_tool_spec(MCP_URL)
                    raw_tools = await tool_spec.to_tool_list_async()
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

            tools = _bind_customer_id(raw_tools, company_id)

            llm = Ollama(model=model, request_timeout=600)

            agent = FunctionAgent(
                llm=llm,
                tools=tools,
                system_prompt=SYSTEM_PROMPT,
            )

            self._agents[cache_key] = agent
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
        Cheap, no-LLM gate that runs BEFORE we spin up the agent workflow.

        Returns True when the message looks like it could be an accounting
        question; False when we should refuse without calling the LLM at all.

        Two layers of detection, both fast (regex only, no model call):

        1. Hard off-topic list — weather, sports, "who is X", programming,
           translation, etc. If any of these match, refuse immediately.

        2. Negative fallback — if the message opens with a generic question
           word (who/what/where/when/why/how old/...) AND contains zero
           accounting keywords, refuse. This catches "who is messi?",
           "what is the capital of france?", "how tall is the eiffel
           tower?" — the kind of question the small keyword list above
           can't possibly enumerate.

        Without layer 2, "who is messi?" fell through to the LLM, which
        had to load the agent + tools + system prompt, then decide to
        refuse on its own — adding many seconds of latency to a question
        we should answer in milliseconds.
        """
        if not message or not message.strip():
            return False

        if _OFF_TOPIC_RE.search(message):
            return False

        # No accounting signal at all, AND it reads like a generic
        # knowledge question → off-topic. (Allowing "how do I / how to"
        # questions through because those ARE legitimate accounting how-tos.)
        if (
            _QUESTION_OPENER_RE.match(message)
            and not _ACCOUNTING_KEYWORD_RE.search(message)
        ):
            return False

        return True

    async def chat(
        self,
        message: str,
        model: str = None,
        session_id: str = None,
        company_id: str = None,
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

        if not company_id:
            yield {
                "model": model,
                "message": {"role": "assistant", "content": ""},
                "done": True,
                "error": "company_id is required for agent chat",
            }
            return

        if not self._is_accounting_question(message):
            yield {
                "model": model,
                "message": {"role": "assistant", "content": REFUSAL_MESSAGE},
                "done": True,
                "refused": True,
            }
            return

        try:
            agent = await self._get_agent(model, company_id)
            ctx = await self._get_context(session_id, agent)

            handler = agent.run(user_msg=message, ctx=ctx)

            async for event in handler.stream_events():
                if type(event).__name__ == "AgentStream":
                    if not event.delta:
                        continue
                    yield {
                        "model": model,
                        "message": {"role": "assistant", "content": event.delta},
                        "done": False,
                    }

            final_response = await handler
            final_text = str(final_response) if final_response is not None else ""

            yield {
                "model": model,
                "message": {"role": "assistant", "content": final_text},
                "done": True,
            }

        except (asyncio.CancelledError, GeneratorExit):
            # The HTTP client disconnected (browser closed, curl -m fired, etc.)
            # while the workflow was still running. Without this branch the
            # cached Context stays in `running=True` and the *next* request
            # for this session dies with "Cannot start a new run while
            # context is already running." Cancel the handler so the workflow
            # actually stops, then drop the poisoned context.
            self._contexts.pop(session_id, None)
            try:
                if "handler" in locals() and hasattr(handler, "cancel"):
                    handler.cancel()
            except Exception:
                # Best-effort: don't let cleanup errors mask the cancellation.
                pass
            raise

        except Exception as e:
            logger.exception("Agent chat failed for session %s", session_id)

            # Drop the cached Context for this session so the next request
            # starts with a fresh one. A previous hung / failed run leaves
            # the Context in an internal `running=True` state; llama-index
            # then refuses any new run on the same Context with
            # "Cannot start a new run while context is already running."
            # Easiest robust fix: forget the poisoned context.
            self._contexts.pop(session_id, None)

            yield {
                "model": model,
                "message": {"role": "assistant", "content": ""},
                "done": True,
                "error": str(e),
            }

agent_service = AgentService()