import { ChatOllama } from "@langchain/ollama";
import { MultiServerMCPClient } from "@langchain/mcp-adapters";
import type { StructuredToolInterface } from "@langchain/core/tools";
import { AIMessage, SystemMessage, type BaseMessage } from "@langchain/core/messages";
import {
  END,
  START,
  StateGraph,
  MessagesAnnotation,
  type Graph,
} from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { HumanMessage } from "@langchain/core/messages";
import { ragPipeline } from "./rag_pipeline.js";

// The subset of the compiled LangGraph agent used by the chat service. The
// compiled `StateGraph` inherits `invoke`/`stream` from `Pregel`, but a generics
// regression in the current @langchain/langgraph typings hides them on the
// concrete `CompiledStateGraph` type, so we describe the shape we rely on here.
export interface AgentInput {
  messages: Array<{ role: string; content: string }>;
}

export interface CompiledAgent {
  invoke(input: AgentInput): Promise<{ messages: BaseMessage[] }>;
  stream(
    input: AgentInput,
    options: { streamMode: "messages" },
  ): Promise<AsyncIterable<[BaseMessage, Record<string, unknown>]>>;
}

const DEFAULT_MODEL = process.env.OLLAMA_MODEL ?? "qwen2.5:14b";
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
const MCP_URL = process.env.MCP_URL ?? "http://localhost:2050/mcp";

const SYSTEM_PROMPT = `
You are an AI Accounting Assistant.
Your job is to answer accounting-related questions and use the available tools when needed.

There is exactly one special case: questions about the current user's own profile
(their userInfo, such as their name, email, company name, company ID, or customer ID).
When the user asks about their own profile/account information, answer using the
provided user information.

For everything else, treat the question as an accounting question. If a question is
neither about the user's own profile nor about accounting, politely explain that you
can only help with accounting questions and questions about the user's own profile.

Accounting guidance:
- Follow the fundamental accounting equation: Assets = Liabilities + Equity.
- Apply double-entry bookkeeping: every transaction affects at least two accounts,
  and total debits must always equal total credits.
- Account normal balances: Assets and Expenses increase with debits; Liabilities,
  Equity, and Income/Revenue increase with credits.
- Chart of accounts is organized by account codes and names; a parent account's
  balance is the aggregate of its child accounts.
- When asked for a balance, figure, or account detail, ALWAYS call the available
  accounting tools to fetch real data instead of guessing or asking for clarification.
- When the user refers to an account by a name (for example "the balance of account
  Aashish Pudasaini" or "detail of account Kumari Bank"), treat that text as the
  account name: call the relevant tool (get-balance or get_account_details) with
  key = "accountName" and value = the given name. For get_account_details, set
  showChild to false unless the user explicitly asks for child accounts. Do NOT ask
  the user to rephrase or to provide a code first — just call the tool. Only if the
  tool reports that nothing was found should you ask the user for a different identifier.
- Never guess the tool's parameter values. For every account lookup the key must be
  one of accountName, name, code, accountCode, accountId, or id (use "accountName"
  when the user gives a name), and value must be the actual identifier the user gave.
  Do not send placeholder values like "accounts" or "all".
- Do not confuse an account name with the current user's own profile: an account
  can be named after a person and is still an accounting account to be looked up
  with the tools.
- For arithmetic on monetary amounts, use the provided math tools when helpful, and
  present amounts clearly with their sign (debit/credit) and, when known, currency.
- Be precise and concise. If required information is missing (e.g., an account name
  or code), ask the user for the specific detail you need before answering.
- Never fabricate account balances, transactions, or figures; rely on tool results.
- In your final answer, present only the resulting information cleanly. Do NOT narrate
  your internal steps or any failed/retried tool calls (never write things like "there
  was an error", "let me try again", or "let me try a different approach"). Just give
  the final, correct answer.
`;

// The compiled langgraph agents, cached per customerId. Built lazily on first
// use so that the HTTP server (which also exposes the MCP endpoint the agent
// connects to) is already listening before we try to fetch the tool list.
const agents = new Map<string, Awaited<ReturnType<typeof buildAgent>>>();
const agentPromises = new Map<
  string,
  Promise<Awaited<ReturnType<typeof buildAgent>>>
>();

// Wrap each MCP tool so that its `customerId` argument is always overridden
// with the customerId coming from the chat payload, regardless of what the LLM
// generated for it.
function withCustomerId(
  tools: StructuredToolInterface[],
  customerId: string,
): StructuredToolInterface[] {
  return tools.map((tool) => {
    const originalInvoke = tool.invoke.bind(tool);
    const wrapped: StructuredToolInterface = Object.create(tool);
    wrapped.invoke = (input, config) => {
      if (input && typeof input === "object") {
        const record = input as Record<string, unknown>;
        if (record.args && typeof record.args === "object") {
          input = {
            ...record,
            args: { ...(record.args as Record<string, unknown>), customerId },
          } as typeof input;
        } else {
          input = { ...record, customerId } as typeof input;
        }
      }
      return originalInvoke(input, config);
    };
    return wrapped;
  });
}

async function buildAgent(customerId: string): Promise<CompiledAgent> {
  const mcpClient = new MultiServerMCPClient({
    mcpServers: {
      accounting: {
        url: MCP_URL,
        transport: "http",
      },
    },
  });

  const rawTools = (await mcpClient.getTools()) as StructuredToolInterface[];
  const tools = withCustomerId(rawTools, customerId);

  const llm = new ChatOllama({
    model: DEFAULT_MODEL,
    baseUrl: OLLAMA_BASE_URL,
  });

  // Bind the tools to the LLM so it can emit tool calls.
  const llmWithTools = llm.bindTools(tools);

  // The tool-executing node.
  const toolNode = new ToolNode(tools);

  // The model-calling node: retrieves relevant accounting knowledge (RAG),
  // prepends the system prompt (augmented with that context) and invokes the LLM.
  const callModel = async (state: typeof MessagesAnnotation.State) => {
    // Use the latest human message as the retrieval query.
    const lastHuman = [...state.messages]
      .reverse()
      .find((m) => m instanceof HumanMessage || m.getType() === "human");

    // `BaseMessage.text` flattens both string and structured content to text.
    const query = lastHuman?.text ?? "";

    const context = query ? await ragPipeline.getContext(query) : "";

    const systemPrompt = context
      ? `${SYSTEM_PROMPT}\nUse the following accounting knowledge to help answer the question:\n${context}`
      : SYSTEM_PROMPT;

    const response = await llmWithTools.invoke([
      new SystemMessage(systemPrompt),
      ...state.messages,
    ]);
    return { messages: [response] };
  };

  // Conditional edge: loop back to the tools node while the model requests
  // tool calls, otherwise finish.
  const shouldContinue = (state: typeof MessagesAnnotation.State) => {
    const lastMessage = state.messages.at(-1) as AIMessage | undefined;
    if (lastMessage?.tool_calls?.length) {
      return "tools";
    }
    return END;
  };

  // Build and compile the graph: START -> agent -> (tools -> agent)* -> END.
  const workflow = new StateGraph(MessagesAnnotation)
    .addNode("agent", callModel)
    .addNode("tools", toolNode)
    .addEdge(START, "agent")
    .addEdge("tools", "agent");

  // `addConditionalEdges` is inherited from the base `Graph` class, but a
  // generics regression in the current @langchain/langgraph typings hides it on
  // the `StateGraph` subtype. Reach it through the base `Graph` view (it mutates
  // the builder in place and returns it), while still compiling the strongly
  // typed `StateGraph` so the returned agent keeps its state types.
  type GraphNode = "agent" | "tools" | typeof START | typeof END;
  (workflow as unknown as Graph<GraphNode>).addConditionalEdges(
    "agent",
    shouldContinue,
    ["tools", END],
  );

  return workflow.compile() as unknown as CompiledAgent;
}

export async function getAgent(customerId: string) {
  const existing = agents.get(customerId);
  if (existing) {
    return existing;
  }
  let promise = agentPromises.get(customerId);
  if (!promise) {
    promise = buildAgent(customerId).then((built) => {
      agents.set(customerId, built);
      return built;
    });
    agentPromises.set(customerId, promise);
  }
  return promise;

}
