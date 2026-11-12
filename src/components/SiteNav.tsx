// The site NavBar with the live follower chip. Shared by the (site) layout
// and the planner layout. Reads Instagram stats, so render it inside <Suspense>
// (SiteNav below does that, with the loading NavBar as the fallback).
import { Suspense } from "react";
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

export function SiteNav() {
  return (
    <Suspense fallback={<NavBar ariaLabel={NAV_LOADING_ARIA} />}>
      <NavWithFollowers />
    </Suspense>
  );
}
