import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import express from "express";

import { registerCallUserTool } from "./tools/call-user.js";
import { registerSendMessageTool, registerWaitForReplyTool, registerEndCallTool } from "./tools/messaging.js";

// Create MCP server
const server = new McpServer({
  name: "cc-caller-mcp-server",
  version: "1.0.0"
});

// Register all tools
registerCallUserTool(server);
registerSendMessageTool(server);
registerWaitForReplyTool(server);
registerEndCallTool(server);

// Run with stdio transport (for local Claude Code integration)
async function runStdio(): Promise<void> {
  console.error("[cc-caller-mcp] Starting with stdio transport...");
  
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  console.error("[cc-caller-mcp] Server connected and ready");
}

// Run with HTTP transport (for remote access)
async function runHTTP(): Promise<void> {
  const app = express();
  app.use(express.json());

  // Health check endpoint
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", server: "cc-caller-mcp-server" });
  });

  // MCP endpoint
  app.post("/mcp", async (req, res) => {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true
    });
    res.on("close", () => transport.close());
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  const port = parseInt(process.env.PORT || "3002");
  app.listen(port, () => {
    console.error(`[cc-caller-mcp] HTTP server running on http://localhost:${port}/mcp`);
  });
}

// Choose transport based on environment
const transport = process.env.TRANSPORT || "stdio";

if (transport === "http") {
  runHTTP().catch((error) => {
    console.error("Server error:", error);
    process.exit(1);
  });
} else {
  runStdio().catch((error) => {
    console.error("Server error:", error);
    process.exit(1);
  });
}
