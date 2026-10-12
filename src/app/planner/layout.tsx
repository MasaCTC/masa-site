import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Planner",
  robots: { index: false, follow: false },
};

export default function PlannerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
