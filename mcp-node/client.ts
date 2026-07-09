import express from "express";
import axios from "axios";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const app = express();
app.use(express.json());

const OLLAMA_URL = "http://localhost:11434/api/chat";

const SYSTEM_PROMPT = `
You are an AI Accounting Assistant.
Only answer accounting-related questions.
`;

app.post("/test-chat", async (req, res) => {
    let transport;
    let client;

    try {
        const { messages = [], model = "qwen2.5:14b" } = req.body;

        // Start stdio MCP server
        transport = new StdioClientTransport({
            command: "node",
            args: [
                "/Users/aashishpudasaini/Desktop/Codes/Accounting System/mcp-node/dist/server.js",
            ],
        });

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
        // Close stdio process
        if (transport) {
            await transport.close().catch(() => {});
        }
    }
});

app.listen(3000, () => {
    console.log("Server running at http://localhost:3000");
});