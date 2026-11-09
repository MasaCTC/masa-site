// Bearer-token check for the MCP endpoint, in the shape mcp-handler's
// withMcpAuth expects. Only an access token for this deployment's
// `${origin}/api/mcp`, minted for the owner, passes. Everything else is
// `undefined` (withMcpAuth then answers 401).
//
// verifyAccessToken THROWS when MCP_OAUTH_SECRET is missing or short; that
// throw is deliberately not caught here. withMcpAuth turns it into a 401
// invalid_token, so a misconfigured secret can never grant tool access.
import type { AuthInfo } from "@modelcontextprotocol/server";
import { mcpResource, requestOrigin, verifyAccessToken } from "./oauth.ts";

export type McpAuthExtra = { githubId: string };

export async function verifyAccess(req: Request, bearer?: string): Promise<AuthInfo | undefined> {
  if (typeof bearer !== "string" || bearer === "") return undefined;
  const info = verifyAccessToken(bearer, { resource: mcpResource(requestOrigin(req)) });
  if (!info) return undefined; // verifyAccessToken already requires scope "planner"
  const extra: McpAuthExtra = { githubId: info.githubId };
  return {
    token: bearer,
    clientId: info.clientId,
    scopes: [info.scope],
    expiresAt: info.expiresAt,
    extra,
  };
}
