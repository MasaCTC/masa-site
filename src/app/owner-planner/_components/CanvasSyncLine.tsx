"use client";
// Canvas sync on open (prototype #syncLine): the page renders from the
// database straight away; once mounted, the provider calls the syncCanvas
// Server Action (owner-checked, 2-minute skip enforced on the server). The
// header line shows "Syncing Canvas…" then "Canvas synced just now · N
// upcoming"; a failure shows the designed error Message inside <Planner>
// (useCanvasSync) with "Try again". The action revalidates /planner, so
// imported tasks appear without a reload.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Button } from "@/components/Button";
import { Message, Spinner } from "@/components/Feedback";
import { cx } from "@/components/types";
import { syncCanvas } from "@/lib/planner/actions";
import type { SyncResult } from "@/lib/planner/canvas-sync-types";
import { needsNewLink, syncErrorCopy, syncLineText, type SyncFail, type SyncPhase } from "../_lib/sync-copy";
import styles from "../planner.module.css";

type SyncState = {
  phase: SyncPhase;
  /** Upcoming assignments in the feed, after the last successful sync this visit. */
  count?: number;
  failure?: SyncFail;
  /** What started the last sync: opening the planner, or a button. */
  when: "open" | "manual";
};

type SyncCtx = SyncState & {
  /** Manual sync ("Try again", "Sync now", after saving a new link). */
  syncNow: () => void;
  pending: boolean;
};

const CanvasSyncContext = createContext<SyncCtx | null>(null);

export function useCanvasSync(): SyncCtx {
  const ctx = useContext(CanvasSyncContext);
  if (!ctx) throw new Error("useCanvasSync outside <CanvasSyncProvider>");
  return ctx;
}

type Outcome = SyncResult | { ok: false; error: "network" };

function toState(r: Outcome, when: SyncState["when"]): SyncState {
  if (!r.ok) return { phase: "failed", failure: r, when };
  switch (r.state) {
    case "synced":
      return { phase: "synced", count: r.count, when };
    case "fresh":
      return { phase: "fresh", when };
    case "no_feed":
      return { phase: "idle", when };
  }
}

export function CanvasSyncProvider({ hasFeed, children }: { hasFeed: boolean; children: React.ReactNode }) {
  const [state, setState] = useState<SyncState>({ phase: hasFeed ? "syncing" : "idle", when: "open" });
  const [pending, startTransition] = useTransition();
  const started = useRef(false);

  const execute = useCallback((when: SyncState["when"]) => {
    startTransition(async () => {
      let r: Outcome;
      try {
        r = await syncCanvas(when === "manual" ? { manual: true } : undefined);
      } catch {
        r = { ok: false, error: "network" };
      }
      setState(toState(r, when));
    });
  }, []);

  // Once per page load, on mount (the ref survives StrictMode's effect
  // re-run, and a feed saved later syncs from Settings instead). The server
  // skips it if a sync succeeded or started < 2 min ago.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (hasFeed) execute("open");
  }, [hasFeed, execute]);

  const syncNow = useCallback(() => {
    setState((s) => ({ ...s, phase: "syncing", failure: undefined, when: "manual" }));
    execute("manual");
  }, [execute]);

  const value = useMemo<SyncCtx>(
    // Feed removed: nothing to sync or report.
    () => ({ ...(hasFeed ? state : { phase: "idle", when: state.when }), syncNow, pending }),
    [hasFeed, state, syncNow, pending],
  );

  return <CanvasSyncContext.Provider value={value}>{children}</CanvasSyncContext.Provider>;
}

/** The header status. Keep the role="status" wrapper: its updates announce. */
export function CanvasSyncLine() {
  const s = useCanvasSync();
  return (
    <span className={cx("mn-mono mn-row", styles.syncLine)} role="status">
      {s.phase === "syncing" ? <Spinner /> : null}
      {syncLineText(s)}
    </span>
  );
}

/**
 * The designed error state (prototype Settings "Error state"): the failure in
 * a plain sentence, "Your existing tasks are untouched.", and a way out
 * (Feedback.md): "Try again", plus "Open Settings" when a new link is the fix.
 */
export function CanvasSyncError({ inSettings, onOpenSettings }: { inSettings: boolean; onOpenSettings: () => void }) {
  const s = useCanvasSync();
  const f = s.failure;
  if (s.phase !== "failed" || !f) return null;
  // Settings already says the saved link can't be read, next to the field.
  if (inSettings && f.error === "sync" && f.reason === "unreadable") return null;
  const copy = syncErrorCopy(f, s.when);
  const linkFix = f.error === "sync" && needsNewLink(f);
  return (
    <div className={styles.syncError}>
      <Message tone="error" detail={copy.detail}>
        {copy.lead}
      </Message>
      {f.error !== "unauthorized" ? (
        <div className="mn-row">
          <Button size="sm" onClick={s.syncNow} loading={s.pending} disabled={s.pending}>
            {s.pending ? "Syncing…" : "Try again"}
          </Button>
          {linkFix && !inSettings ? (
            <Button size="sm" variant="ghost" onClick={onOpenSettings}>
              Open Settings
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
