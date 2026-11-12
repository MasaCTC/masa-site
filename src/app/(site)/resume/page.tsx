// Resume (design/screens/Resume.dc.html). Server component: finishes the timeline entries
// (the @masamcodes stack is filled from getInstagramStats(), never the raw "{followers}"
// template) and hands them to the ResumeView island. The Suspense fallback is the same view
// with the Instagram stack line omitted.
import type { Metadata } from "next";
import { Suspense } from "react";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { DownloadIcon } from "@/components/icons";
import { Meter } from "@/components/Meter";
import { EDUCATION, ENTRIES, RESUME_PAGE } from "@/content/resume";
import { CONTACT, PDF_URL } from "@/content/site";
import { getInstagramStats, INSTAGRAM_SOURCE_KIND } from "@/lib/instagram";
import { formatMonthYear, metricCompact } from "@/lib/instagram/format";
import type { InstagramStats, SourceKind } from "@/lib/instagram/types";
import main from "../main.module.css";
import { ResumeView, type ResumeViewEntry } from "./ResumeView";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Resume",
};

/** Finished entries. Without stats (loading) the Instagram stack line is left out. */
function finishEntries(source: SourceKind, stats: InstagramStats | null): ResumeViewEntry[] {
  return ENTRIES.map((e) => {
    let stack: string | undefined = e.stack;
    let bullets = e.bullets;
    if (e.stackFromStats) {
      stack = stats
        ? e.stack
            .replace("{followers}", metricCompact(stats.followers))
            .replace("{views}", metricCompact(stats.totals.views))
        : undefined;
      bullets = e.bulletsBySource?.[source] ?? e.bullets;
    }
    const when = e.when.replace("{start} – ", stats ? `${formatMonthYear(stats.startDate)} – ` : "");
    return { id: e.id, title: e.title, sub: e.sub, when, bullets, stack, tags: e.tags };
  });
}

const head = (
  <div className="mn-section__head">
    <div className={styles.headCol}>
      <span className="mn-label">{RESUME_PAGE.eyebrow}</span>
      <h1 className="mn-display-lg">{RESUME_PAGE.title}</h1>
    </div>
    <div className={`mn-row ${styles.buttons}`}>
      {/* Download PDF: the page's primary action, disabled until PDF_URL is set (item 11). */}
      <Button variant="primary" icon={<DownloadIcon />} href={PDF_URL ?? undefined} disabled={PDF_URL == null}>
        {RESUME_PAGE.download}
      </Button>
      <Button href={CONTACT.emailHref}>{RESUME_PAGE.email}</Button>
    </div>
  </div>
);

const education = (
  <Card as="section" ariaLabel={EDUCATION.label}>
    <span className="mn-label">{EDUCATION.label}</span>
    <div className="mn-card__row">
      <h2 className="mn-heading-sm">{EDUCATION.school}</h2>
      <span className="mn-mono">{EDUCATION.dates}</span>
    </div>
    <p className={styles.flush}>{EDUCATION.degree}</p>
    <Meter label={EDUCATION.meterLabel} valueText={EDUCATION.meterValueText} ratio={EDUCATION.meterRatio} />
  </Card>
);

async function ResumeWithStats() {
  const stats = await getInstagramStats();
  return <ResumeView head={head} education={education} entries={finishEntries(stats.source, stats)} />;
}

export default function ResumePage() {
  return (
    <main className={`${main.main} ${styles.resumeMain}`}>
      <Suspense
        fallback={<ResumeView head={head} education={education} entries={finishEntries(INSTAGRAM_SOURCE_KIND, null)} />}
      >
        <ResumeWithStats />
      </Suspense>
    </main>
  );
}
