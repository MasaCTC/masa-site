import { Suspense, type ReactNode } from "react";
import { Footer } from "@/components/Footer";
import { NavBar } from "@/components/NavBar";
import { INSTAGRAM_COPY, NAV_LOADING_ARIA } from "@/content/site";
import { getInstagramStats } from "@/lib/instagram";
import { compact, exact } from "@/lib/instagram/format";

/** The follower chip: real count from getInstagramStats(); "—" (NavBar default) when unknown. */
async function NavWithFollowers() {
  const stats = await getInstagramStats();
  const f = stats.followers;
  if (f.kind !== "value") return <NavBar ariaLabel={NAV_LOADING_ARIA} />;
  return (
    <NavBar
      followersText={compact(f.value)}
      ariaLabel={INSTAGRAM_COPY[stats.source].navAria(exact(f.value))}
    />
  );
}

// Each page renders its own <main> (display: contents, see main.module.css), so the
// mn-page flex gap between nav, sections and footer is unchanged.
export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mn-page">
      <Suspense fallback={<NavBar ariaLabel={NAV_LOADING_ARIA} />}>
        <NavWithFollowers />
      </Suspense>
      {children}
      <Footer />
    </div>
  );
}
