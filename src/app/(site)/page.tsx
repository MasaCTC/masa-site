// Home (design/screens/HomeA.dc.html, navDock header, tagline 1). Server component: static
// copy from src/content, the "Instagram, in numbers" section from getInstagramStats() inside
// Suspense (the fallback is the same section in its loading state).
import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { BarList } from "@/components/BarList";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Chart } from "@/components/Chart";
import { Message } from "@/components/Feedback";
import { ArrowUpRightIcon, DownloadIcon } from "@/components/icons";
import { Link } from "@/components/Link";
import { Meter } from "@/components/Meter";
import { StatusLabel } from "@/components/StatusLabel";
import { ProgressTrack } from "@/components/ProgressTrack";
import { StatTile } from "@/components/StatTile";
import { HOME_PROJECT_CARDS, COFURA, ONE_BASKET, PULLPILOT } from "@/content/projects";
import { EDUCATION } from "@/content/resume";
import { CONTACT, HOME, PDF_URL, STATS_COPY, TAGLINE } from "@/content/site";
import { getInstagramStats } from "@/lib/instagram";
import {
  chartState,
  followerHistoryOf,
  followersTile,
  growthViews,
  interactionsTile,
  statusView,
  topShareText,
  totalTile,
  viewsBars,
  type TileView,
} from "@/lib/instagram/view";
import main from "./main.module.css";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: { absolute: "Masa Chien" },
};

const dots = (phases: readonly { status: "done" | "current" | "upcoming" }[]) =>
  phases.map((p) => ({ status: p.status }));

function Tile({ t }: { t: TileView }) {
  return (
    <StatTile label={t.label} valueText={t.valueText} title={t.title} meta={t.meta} metaKind={t.metaKind} state={t.state} />
  );
}

/** The stats section in its loading state (Suspense fallback). */
function HomeStatsLoading() {
  const labels = [STATS_COPY.tileLabels.followers, STATS_COPY.tileLabels.views, STATS_COPY.tileLabels.interactions];
  return (
    <HomeStatsFrame
      status={<Message tone="loading" as="span">{STATS_COPY.loadingHeadline}</Message>}
      tiles={labels.map((l) => <StatTile key={l} label={l} state="loading" />)}
      chart={<Chart state="loading" interactive={false} caption={<span className="mn-label">{STATS_COPY.homeChartLabel}</span>} />}
      barsMono={null}
      bars={
        <BarList
          state="loading"
          ariaLabel={STATS_COPY.homeTopReelsLabel}
          items={[1, 2, 3].map((r) => ({ label: `Reel ${r}`, valueText: "—", title: "" }))}
        />
      }
    />
  );
}

async function HomeStats() {
  const stats = await getInstagramStats();
  const status = statusView(stats);
  const views = growthViews(followerHistoryOf(stats), stats.startDate);
  const series = views?.["90D"];
  const state = chartState(stats, series);
  const tiles = [
    followersTile(stats),
    totalTile(stats, STATS_COPY.tileLabels.views, stats.totals.views, "views"),
    interactionsTile(stats),
  ];
  const bars = viewsBars(stats);
  return (
    <HomeStatsFrame
      status={<span className="mn-mono">{status.dateLine}</span>}
      tiles={tiles.map((t) => <Tile key={t.label} t={t} />)}
      chart={
        <Chart
          state={state}
          interactive={false}
          points={series?.points}
          linePath={series?.linePath}
          areaPath={series?.areaPath}
          ticks={series?.ticks}
          xLabels={series ? { start: series.xLabels.start, end: series.xLabels.end } : undefined}
          ariaLabel={series?.ariaLabel}
          caption={
            <>
              <span className="mn-label">{STATS_COPY.homeChartLabel}</span>
              {state === "ready" && series ? <span className="mn-mono">{series.change}</span> : null}
            </>
          }
        />
      }
      barsMono={<span className="mn-mono">{topShareText(stats)}</span>}
      bars={
        <BarList
          items={bars}
          ariaLabel={STATS_COPY.homeTopReelsLabel}
          state={stats.status === "empty" || bars.length === 0 ? "empty" : "ready"}
        />
      }
    />
  );
}

function HomeStatsFrame({
  status,
  tiles,
  chart,
  barsMono,
  bars,
}: {
  status: ReactNode;
  tiles: ReactNode;
  chart: ReactNode;
  barsMono: ReactNode;
  bars: ReactNode;
}) {
  return (
    <section className="mn-section">
      <div className="mn-section__head">
        <div className={styles.headCol}>
          <h2 className="mn-heading-md">{HOME.statsHeading}</h2>
          {status}
        </div>
        <Link href="/stats" arrow="next">
          {HOME.statsLink}
        </Link>
      </div>
      <div className="mn-grid">{tiles}</div>
      <div className={styles.chartGrid}>
        {chart}
        <Card as="div" className={styles.barsCard}>
          <div className="mn-card__row">
            <span className="mn-label">{STATS_COPY.homeTopReelsLabel}</span>
            {barsMono}
          </div>
          {bars}
        </Card>
      </div>
    </section>
  );
}

export default function Home() {
  const [oneBasket, cofura, pullpilot] = HOME_PROJECT_CARDS;
  return (
    <main className={main.main}>
      <Card as="section" size="lg" className={styles.hero}>
        <div className={styles.heroCol}>
          <span className="mn-label">{HOME.eyebrow}</span>
          <h1 className="mn-display-xl">Masa Chien</h1>
          <p className={`mn-body-lg ${styles.tagline}`}>{TAGLINE}</p>
          <div className={`mn-row ${styles.buttons}`}>
            <Button variant="primary" href={CONTACT.instagram}>
              Follow @masamcodes
            </Button>
            <Button href={CONTACT.github} trailingIcon={<ArrowUpRightIcon />}>
              GitHub
            </Button>
          </div>
        </div>
        <Card as="div" variant="inset" className={styles.rightNow}>
          <span className="mn-label">{HOME.rightNow.label}</span>
          <div className={styles.rows}>
            {HOME.rightNow.rows.map((row) => (
              <div key={row.text} className="mn-card__row">
                <span>{row.text}</span>
                {"status" in row ? (
                  <StatusLabel variant={row.status}>{row.statusLabel}</StatusLabel>
                ) : (
                  <span className="mn-mono">{row.mono}</span>
                )}
              </div>
            ))}
          </div>
        </Card>
      </Card>

      <Suspense fallback={<HomeStatsLoading />}>
        <HomeStats />
      </Suspense>

      <section className="mn-section">
        <div className="mn-section__head">
          <h2 className="mn-heading-md">{HOME.buildingHeading}</h2>
          <Link href="/projects" arrow="next">
            {HOME.buildingLink}
          </Link>
        </div>
        <div className="mn-grid">
          <Card href="/projects">
            <div className="mn-card__row">
              <h3 className="mn-heading-sm">{oneBasket.name}</h3>
              <StatusLabel variant={oneBasket.status}>{oneBasket.statusLabel}</StatusLabel>
            </div>
            <p className="mn-body-sm">{oneBasket.summary}</p>
            <ProgressTrack phases={dots(ONE_BASKET.phases)} ariaLabel={ONE_BASKET.homeMapAriaLabel} note={ONE_BASKET.homeCaption} />
          </Card>
          <Card href="/projects">
            <div className="mn-card__row">
              <h3 className="mn-heading-sm">{cofura.name}</h3>
              <StatusLabel variant={cofura.status}>{cofura.statusLabel}</StatusLabel>
            </div>
            <p className="mn-body-sm">{cofura.homeSummary}</p>
            <ProgressTrack phases={dots(COFURA.phases)} ariaLabel={COFURA.homeMapAriaLabel} note={COFURA.homeCaption} />
          </Card>
          <Card variant="dead">
            <div className="mn-card__row">
              <h3 className="mn-heading-sm">{pullpilot.name}</h3>
              <StatusLabel variant={pullpilot.status}>{pullpilot.statusLabel}</StatusLabel>
            </div>
            <p className="mn-body-sm">{pullpilot.summary}</p>
            <p className={styles.deadBody}>{PULLPILOT.homeBody}</p>
            <Link href="/projects" arrow="none">
              {PULLPILOT.homeLink}
            </Link>
          </Card>
        </div>
      </section>

      <Card as="section" size="lg" className={styles.resume}>
        <div className={styles.resumeCol}>
          <span className="mn-label">{HOME.resume.label}</span>
          <h2 className="mn-heading-md">{HOME.resume.heading}</h2>
          <p className="mn-body-sm">{HOME.resume.body}</p>
          <Meter
            className={styles.meter}
            label={HOME.resume.degreeMeterLabel}
            valueText={EDUCATION.meterValueText}
            ratio={EDUCATION.meterRatio}
            footnote={HOME.resume.degreeMeta}
          />
        </div>
        <div className={`mn-row ${styles.resumeButtons}`}>
          <Button href="/resume">{HOME.resume.open}</Button>
          {/* Download PDF: disabled until PDF_URL is set (decision 4, item 11). */}
          <Button variant="ghost" icon={<DownloadIcon />} href={PDF_URL ?? undefined} disabled={PDF_URL == null}>
            {HOME.resume.download}
          </Button>
        </div>
      </Card>
    </main>
  );
}
