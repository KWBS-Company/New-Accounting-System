/**
 * Calculator MCP server built with the official Node.js MCP SDK
 * (@modelcontextprotocol/sdk).
 *
 * Tools: add, subtract, multiply, divide
 *
 * Install:
 *   npm install @modelcontextprotocol/sdk zod
 *   npm install -D typescript @types/node
 *
 * Run (stdio transport - what Claude Desktop / most MCP clients use):
 *   npx tsx src/server.ts
 *   # or compile first: tsc && node dist/server.js
 *
 * Test interactively with the MCP inspector:
 *   npx @modelcontextprotocol/inspector npx tsx src/server.ts
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

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

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Nothing should be written to stdout after this besides MCP protocol
  // messages - use stderr for any debug logging.
  console.error("Calculator MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error starting MCP server:", err);
  process.exit(1);
});
