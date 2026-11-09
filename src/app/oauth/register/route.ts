// RFC 7591 dynamic client registration (public clients, signed client ids).
import { connection } from "next/server";
import { handleCorsPreflight, handleRegister } from "@/lib/mcp/oauth-http";

export async function POST(req: Request) {
  await connection();
  return handleRegister(req);
}

export function OPTIONS() {
  return handleCorsPreflight();
}
