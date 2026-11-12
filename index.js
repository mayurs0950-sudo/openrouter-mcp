import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import dotenv from "dotenv";
import fetch from "node-fetch";

dotenv.config();

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

if (!OPENROUTER_API_KEY) {
  console.error("Error: OPENROUTER_API_KEY is missing in .env file.");
  process.exit(1);
}

// MCP सर्व्हर इनिशियलाइज करा
const server = new Server(
  {
    name: "openrouter-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// उपलब्ध टूल्सची यादी (OpenRouter वरील चॅट / कम्प्लिटेशन टूल)
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "openrouter_chat",
        description: "Send a prompt to any OpenRouter model and get a response.",
        inputSchema: {
          type: "object",
          properties: {
            prompt: {
              type: "string",
              description: "The prompt or question to send to the AI model.",
            },
            model: {
              type: "string",
              description: "The OpenRouter model ID (e.g., 'anthropic/claude-3.5-sonnet', 'openai/gpt-4o'). Default is Claude 3.5 Sonnet.",
              default: "anthropic/claude-3.5-sonnet",
            },
          },
          required: ["prompt"],
        },
      },
    ],
  };
});

// टूल एक्झिक्युट करण्यासाठी लॉजिक
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "openrouter_chat") {
    const { prompt, model = "anthropic/claude-3.5-sonnet" } = request.params.arguments;

    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://github.com/mcp-openrouter", // पर्यायी (OpenRouter rankings साठी)
          "X-Title": "MCP OpenRouter Server",
        },
        body: JSON.stringify({
          model: model,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || "Failed to fetch from OpenRouter");
      }

      const answer = data.choices[0]?.message?.content || "No response received.";

      return {
        content: [
          {
            type: "text",
            text: answer,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error calling OpenRouter: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  throw new Error(`Tool not found: ${request.params.name}`);
});

// STDIO द्वारे सर्व्हर सुरू करा (Cloud Connectors किंवा Claude Desktop साठी आवश्यक)
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("OpenRouter MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});