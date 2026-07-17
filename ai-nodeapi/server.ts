import 'reflect-metadata';
import express, { Request, Response } from "express";
import { createMcpServer } from './tool.js'
import chatRouter from './chat_router.js';
import ragRouter from './rag_router.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { randomUUID } from "node:crypto";

const app = express();

app.use(express.json());

app.use('/api', chatRouter);
app.use('/api', ragRouter);


// ---------------------------------------------------------------------------
// Streamable HTTP transport wiring - single /mcp endpoint handling
// POST (client -> server, incl. session init), GET (server -> client stream
// for a given session), and DELETE (session teardown).
// ---------------------------------------------------------------------------
const activeTransports: Record<string, StreamableHTTPServerTransport> = {};

app.get('/health', (req: Request, res: Response) => {
  res.json({ status: "ok" });
})

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

    // Use a fresh McpServer instance per session so each transport owns its
    // own MCP Server (Protocol); a shared instance can only connect once.
    const mcpServer = createMcpServer();
    await mcpServer.connect(transport);
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

app.listen(2050, () => {
  console.log("Server running at http://localhost:2050");
});