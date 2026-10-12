// /now (design/screens/Planner.prototype.html, "PUBLIC /now"). Public, no auth.
// The shell is static; the status card streams from a cached read (now-data.ts).
// Only the status the owner chose to publish and two counts are shown: never a task title.
import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { Card } from "@/components/Card";
import { Meter } from "@/components/Meter";
import { cx } from "@/components/types";
import main from "../main.module.css";
import { getNowView, type NowView } from "./now-data";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Now",
  description: "What Masa is working on right now, set by hand, with today's progress.",
};

function Skeletons() {
  return (
    <Card size="lg" as="section" state="loading" className={styles.card} ariaLabel="Loading status" />
  );
}

async function NowCard() {
  let v: NowView;
  try {
    v = await getNowView();
  } catch (e) {
    // Do not bake the error into the prerender: render it per request instead.
    console.error("/now: could not load status", e instanceof Error ? e.name : "error");
    await connection();
    return (
      <Card
        size="lg"
        as="section"
        state="error"
        className={styles.card}
        errorText="Couldn't load my status. Try again in a minute."
      />
    );
  }

  const unset = v.since === null;
  const ratio = v.total > 0 ? v.done / v.total : undefined;

  return (
    <Card size="lg" as="section" className={styles.card} ariaLabel="Current status">
      <div className={cx("mn-status", v.mode === "free" && "is-free")}>
        <span className="mn-status__dot" />
        <span className={cx("mn-status__text", unset && styles.unset)}>{unset ? "No status set" : v.line}</span>
      </div>
      {unset ? null : (
        <span className="mn-mono">
          since {v.since} · updated {v.updated}
        </span>
      )}
      <Meter
        label="Today's list"
        valueText={`${v.done} of ${v.total} done`}
        ratio={ratio}
        ariaLabel="Tasks done today"
        emptyReason="Nothing on today's list."
      />
    </Card>
  );
}

export default function NowPage() {
  return (
    <main className={main.main}>
      <div className={cx("mn-section", styles.wrap)}>
        <header className={styles.head}>
          <span className="mn-label">/now</span>
          <h1 className="mn-display-lg">What I&apos;m on right now</h1>
          <p className={cx("mn-body-lg", styles.lead)}>Set by hand from my planner. Task details stay private.</p>
        </header>
        <Suspense fallback={<Skeletons />}>
          <NowCard />
        </Suspense>
      </div>
    </main>
  );
}
