import { requireOwner } from "@/lib/owner";

// The session is read at request time; no Suspense so notFound() happens
// before any bytes stream and the response is a real 404.
export const instant = false;

export default async function PlannerPage() {
  await requireOwner();
  return <h1>Planner</h1>;
}
