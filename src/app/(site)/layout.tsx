import type { ReactNode } from "react";
import { Footer } from "@/components/Footer";
import { SiteNav } from "@/components/SiteNav";

// Each page renders its own <main> (display: contents, see main.module.css), so the
// mn-page flex gap between nav, sections and footer is unchanged.
export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mn-page">
      <SiteNav />
      {children}
      <Footer />
    </div>
  );
}
