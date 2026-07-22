import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getAccountDetail, getBalance, listAccounts } from "./api.js";

// Build a fresh McpServer instance with all accounting tools registered.
// A new instance must be created per transport/session: the underlying MCP
// `Server` (Protocol) can only be connected to one transport at a time, so
// sharing a single instance across sessions throws
// "Already connected to a transport." on the second connection.
export function createMcpServer(): McpServer {
  const mcpServer = new McpServer({
    name: "accounting_mcp_server",
    version: "1.0.0",
  });

  registerTools(mcpServer);
  return mcpServer;
}

function registerTools(mcpServer: McpServer): void {
  mcpServer.registerTool(
  "get-balance",
  {
    title: "Get Balance",
    description: "Get balance by accountName or accountCode or accountId or id or name or code",
    inputSchema: {
      key: z.string().describe("Key of accountName or name or code or accountCode or accountId or id"),
      value: z.string().describe("Value of accountName or name or code or accountCode or accountId or id"),
      customerId: z.string().describe('Customer ID - system will override this automatically')
    },
  },
  async ({ key, value, customerId }) => {
    const balance = await getBalance(key, value, customerId);
    if (!balance) {
      return { content: [{ type: 'text', text: 'balance not found' }] };
    }
    return { content: [{ type: 'text', text: JSON.stringify(balance) }] };
  },
);


mcpServer.registerTool(
  "list_accounts",
  {
    title: "List accounts",
    description: "List accounts",
    inputSchema: {
      key: z.string().describe("always put accounts value"),
      value: z.string().describe("always put all value"),
      customerId: z.string().describe('Customer ID - system will override this automatically')
    },
  },
  async ({ key, value, customerId }) => {
    const accounts = await listAccounts(key, value, customerId);
    if (accounts && accounts.length === 0) {
      return { content: [{ type: 'text', text: 'account list not found' }] };
    }
    return { content: [{ type: 'text', text: JSON.stringify(accounts) }] };
  },
);


mcpServer.registerTool(
  "get_account_details",
  {
    title: "Get account detail",
    description: "Get account details by accountName or accountCode or accountId or id or name or code with option of showChild",
    inputSchema: {
      key: z.string().describe("Key to look up the account by: one of accountName, name, code, accountCode, accountId, or id"),
      value: z.string().describe("The value corresponding to the key, e.g. the account name 'Kumari Bank' when key is 'accountName'"),
      showChild: z.boolean().describe("put true if user wants to list children otherwise false"),
      customerId: z.string().describe('Customer ID - system will override this automatically')
    },
  },
  async ({ key, value, showChild, customerId }) => {
    const filters = { showChild }
    const account = await getAccountDetail(key, value, customerId, filters);
    if (!account) {
      return { content: [{ type: 'text', text: 'account not found' }] };
    }
    return { content: [{ type: 'text', text: JSON.stringify(account) }] };
  },
  );
}