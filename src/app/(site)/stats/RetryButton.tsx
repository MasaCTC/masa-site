"use client";
// "Try again" (Stats.dc.html error banner + chart error): re-renders the route on the server
// with router.refresh(), which re-reads getInstagramStats().
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { RetryIcon } from "@/components/icons";
import { STATS_COPY } from "@/content/site";

export function RetryButton({ withIcon = false }: { withIcon?: boolean }) {
  const router = useRouter();
  return (
    <Button size="sm" icon={withIcon ? <RetryIcon /> : undefined} onClick={() => router.refresh()}>
      {STATS_COPY.retry}
    </Button>
  );
}
