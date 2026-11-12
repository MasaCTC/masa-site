// RFC 9728 protected resource metadata for /api/mcp.
import { connection } from "next/server";
import { handleCorsPreflight, handleProtectedResourceMetadata } from "@/lib/mcp/oauth-http";

export async function GET(req: Request) {
  await connection();
  return handleProtectedResourceMetadata(req);
}

export function OPTIONS() {
  return handleCorsPreflight();
}
