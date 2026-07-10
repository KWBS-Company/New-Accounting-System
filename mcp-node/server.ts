import express, { type Request, type Response } from "express";
import axios from "axios";
import { randomUUID } from "node:crypto";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { getAccountDetail, getBalance, listAccounts } from "./api.js";

const OLLAMA_URL = "http://localhost:11434/api/chat";
const MCP_URL = "http://localhost:3000/mcp"; // same app, single streamable-http route

const SYSTEM_PROMPT = `
You are an AI Accounting Assistant.
Only answer accounting-related questions.
`;

// ---------------------------------------------------------------------------
// MCP Server factory - Streamable HTTP is stateful per-session, and an
// McpServer instance can only be bound to one transport at a time, so we
// build a fresh server (with tools registered) for every new session.
// ---------------------------------------------------------------------------
function getServer() {
  const server = new McpServer({
    name: "calculator",
    version: "1.0.0",
  });

  // ---------- add ----------
  server.registerTool(
    "add",
    {
      title: "Add",
      description: "Add two numbers together and return the sum.",
      inputSchema: {
        a: z.number().describe("First operand"),
        b: z.number().describe("Second operand"),
      },
    },
    async ({ a, b }) => ({
      content: [{ type: "text", text: String(a + b) }],
    }),
  );

  // ---------- subtract ----------
  server.registerTool(
    "subtract",
    {
      title: "Subtract",
      description:
        "Subtract the second number from the first and return the difference.",
      inputSchema: {
        a: z.number().describe("First operand"),
        b: z.number().describe("Second operand"),
      },
    },
    async ({ a, b }) => ({
      content: [{ type: "text", text: String(a - b) }],
    }),
  );

  // ---------- multiply ----------
  server.registerTool(
    "multiply",
    {
      title: "Multiply",
      description: "Multiply two numbers together and return the product.",
      inputSchema: {
        a: z.number().describe("First operand"),
        b: z.number().describe("Second operand"),
      },
    },
    async ({ a, b }) => ({
      content: [{ type: "text", text: String(a * b) }],
    }),
  );

  // ---------- divide ----------
  server.registerTool(
    "divide",
    {
      title: "Divide",
      description: "Divide the first number by the second and return the quotient.",
      inputSchema: {
        a: z.number().describe("Numerator"),
        b: z.number().describe("Denominator (must not be zero)"),
      },
    },
    async ({ a, b }) => {
      if (b === 0) {
        return {
          isError: true,
          content: [{ type: "text", text: "Division by zero is not allowed" }],
        };
      }
      return {
        content: [{ type: "text", text: String(a / b) }],
      };
    },
  );

  server.registerTool(
    "get-balance",
    {
      title: "Get Balance",
      description: "Get balance by accountName or accountCode or accountId or id or name or code",
      inputSchema: {
        key: z.string().describe("Key of accountName or name or code or accountCode or accountId or id"),
        value: z.string().describe("Value of accountName or name or code or accountCode or accountId or id"),
      },
    },
    async ({ key, value }) => {
      const balance = await getBalance(key, value);
      if (!balance) {
        return { content: [{ type: 'text', text: 'balance not found' }] };
      }
      return { content: [{ type: 'text', text: JSON.stringify(balance) }] };
    },
  );

  server.registerTool(
    "list_accounts",
    {
      title: "List accounts",
      description: "List accounts",
      inputSchema: {
        key: z.string().describe("always put accounts value"),
        value: z.string().describe("always put all value"),
      },
    },
    async ({ key, value }) => {
      const accounts = await listAccounts(key, value);
      if (accounts && accounts.length === 0) {
        return { content: [{ type: 'text', text: 'account list not found' }] };
      }
      return { content: [{ type: 'text', text: JSON.stringify(accounts) }] };
    },
  );

  server.registerTool(
    "get_account_details",
    {
      title: "Get account detail",
      description: "Get account by accountName or accountCode or accountId or id or name or code with option of showChild",
      inputSchema: {
        key: z.string().describe("always put accounts value"),
        value: z.string().describe("always put all value"),
        showChild: z.boolean().describe("put true if user wants to list children otherwise false"),
      },
    },
    async ({ key, value, showChild }) => {
      const filters = { showChild }
      const account = await getAccountDetail(key, value, filters);
      if (!account) {
        return { content: [{ type: 'text', text: 'account not found' }] };
      }
      return { content: [{ type: 'text', text: JSON.stringify(account) }] };
    },
  );

  return server;
}

// ---------------------------------------------------------------------------
// Streamable HTTP transport wiring - single /mcp endpoint handling
// POST (client -> server, incl. session init), GET (server -> client stream
// for a given session), and DELETE (session teardown).
// ---------------------------------------------------------------------------
const activeTransports: Record<string, StreamableHTTPServerTransport> = {};

const app = express();
app.use(express.json());

app.post("/mcp", async (req: Request, res: Response) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  let transport: StreamableHTTPServerTransport;

  if (sessionId && activeTransports[sessionId]) {
    transport = activeTransports[sessionId];
  } else if (!sessionId && isInitializeRequest(req.body)) {
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (newSessionId: string) => {
        activeTransports[newSessionId] = transport;
      },
    });

    transport.onclose = () => {
      if (transport.sessionId) {
        delete activeTransports[transport.sessionId];
      }
    };

    const server = getServer();
    await server.connect(transport);
  } else {
    res.status(400).json({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Bad Request: No valid session ID provided" },
      id: null,
    });
    return;
  }

  await transport.handleRequest(req, res, req.body);
});

// GET is the server -> client notification stream for an existing session;
// DELETE tears the session down. Both need an established session id.
async function handleSessionRequest(req: Request, res: Response) {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;

  if (!sessionId || !activeTransports[sessionId]) {
    res.status(400).send("Invalid or missing session ID");
    return;
  }

  const transport = activeTransports[sessionId];
  await transport.handleRequest(req, res);
}

app.get("/mcp", handleSessionRequest);
app.delete("/mcp", handleSessionRequest);

// ---------------------------------------------------------------------------
// Test chat endpoint - connects to the MCP server over Streamable HTTP.
// ---------------------------------------------------------------------------
app.post("/test-chat", async (req, res) => {
  let transport;
  let client;

  try {
    const { messages = [], model = "qwen2.5:14b" } = req.body;

    transport = new StreamableHTTPClientTransport(new URL(MCP_URL));

    client = new Client({
      name: "ollama-test-client",
      version: "1.0.0",
    });

    await client.connect(transport);

    // Fetch MCP tools
    const { tools } = await client.listTools();

    const ollamaTools = tools.map((tool) => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema,
      },
    }));

    const conversation = [
      {
        role: "system",
        content: SYSTEM_PROMPT,
      },
      ...messages,
    ];

    // First Ollama call
    let { data } = await axios.post(OLLAMA_URL, {
      model,
      stream: false,
      messages: conversation,
      tools: ollamaTools,
    });

    console.log(data.message);

    const toolCalls = data.message.tool_calls ?? [];

    // Execute tools if requested
    if (toolCalls.length > 0) {
      conversation.push(data.message);

      for (const toolCall of toolCalls) {
        const result = await client.callTool({
          name: toolCall.function.name,
          arguments: toolCall.function.arguments,
        });

        console.log(result);

        conversation.push({
          role: "tool",
          content: JSON.stringify(result.content),
        });
      }

      // Second Ollama call
      ({ data } = await axios.post(OLLAMA_URL, {
        model,
        stream: false,
        messages: conversation,
        tools: ollamaTools,
      }));

      console.log(data.message);
    }

    res.json({
      success: true,
      message: data.message,
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    });
  } finally {
    // Close the streamable HTTP client session
    if (transport) {
      await transport.close().catch(() => { });
    }
  }
});

app.listen(3000, () => {
  console.log("Server running at http://localhost:3000");
  console.log("MCP endpoint at http://localhost:3000/mcp");
});