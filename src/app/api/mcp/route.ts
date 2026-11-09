// MCP endpoint (Streamable HTTP) for the planner connector. Owner-only bearer
// auth and the tools live in src/lib/mcp/server.ts. This is a static route:
// mcp-handler 2.x has no basePath/[transport] routing, and nothing else
// (no SSE, no /api/<other>) is served.
import { connection } from "next/server";
import { handleMcp } from "@/lib/mcp/server";

async function handler(req: Request): Promise<Response> {
  await connection();
  return handleMcp(req);
}

export { handler as GET, handler as POST, handler as DELETE };
