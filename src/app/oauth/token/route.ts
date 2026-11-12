// OAuth 2.1 token endpoint (authorization_code + PKCE, refresh_token).
import { connection } from "next/server";
import { handleToken, handleTokenPreflight } from "@/lib/mcp/oauth-http";

export async function POST(req: Request) {
  await connection();
  return handleToken(req);
}

export function OPTIONS() {
  return handleTokenPreflight();
}
