// GitHub returns here after the MCP consent's Approve. A static segment, so it
// wins over the Auth.js catch-all at /api/auth/[...nextauth]; Auth.js keeps
// /api/auth/callback/github for site sign-in.
import { connection } from "next/server";
import { handleGithubCallback } from "@/lib/mcp/oauth-http";

export async function GET(req: Request) {
  await connection();
  return handleGithubCallback(req);
}
