import { signIn } from "@/auth";

// No UI: visiting /login goes straight to GitHub. Non-owners are rejected
// by the signIn callback in src/auth.ts.
export async function GET() {
  return signIn("github", { redirectTo: "/planner" });
}
