// GET shows the consent screen; POST (the Approve button) sends the owner to
// GitHub. Nothing goes to GitHub before Approve.
import { connection } from "next/server";
import { handleAuthorizeGet, handleAuthorizePost } from "@/lib/mcp/oauth-http";

export async function GET(req: Request) {
  await connection();
  return handleAuthorizeGet(req);
}

export async function POST(req: Request) {
  await connection();
  return handleAuthorizePost(req);
}
