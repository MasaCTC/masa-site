// RFC 8414 authorization server metadata for the MCP connector.
import { connection } from "next/server";
import { handleAuthorizationServerMetadata, handleCorsPreflight } from "@/lib/mcp/oauth-http";

export async function GET(req: Request) {
  await connection();
  return handleAuthorizationServerMetadata(req);
}

export function OPTIONS() {
  return handleCorsPreflight();
}
