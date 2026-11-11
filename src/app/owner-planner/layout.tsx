import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SiteNav } from "@/components/SiteNav";

export const metadata: Metadata = {
  title: "Planner",
  robots: { index: false, follow: false },
};

// Same page frame as the site (mn-page + the dock NavBar), no footer (prototype).
export default function PlannerLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mn-page">
      <SiteNav />
      {children}
    </div>
  );
}
