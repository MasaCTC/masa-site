import type { ReactNode } from "react";
import { Footer } from "@/components/Footer";
import { NavBar } from "@/components/NavBar";

// TODO(Task 3/4): replace with getInstagramStats() via src/lib/instagram/format.ts.
// Placeholder only: the real follower count from decision 5 (14,136), formatted by hand.
const NAV_FOLLOWERS_TEXT = "14.1K";
const NAV_FOLLOWERS_ARIA = "14,136 followers. Open stats";

export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mn-page">
      <NavBar followersText={NAV_FOLLOWERS_TEXT} ariaLabel={NAV_FOLLOWERS_ARIA} />
      {children}
      <Footer />
    </div>
  );
}
