// Stats (design/screens/Stats.dc.html). Server component: everything below the static title
// comes from getInstagramStats() inside Suspense; the fallback is the screen's loading state.
// Status 'live' / 'error' / 'empty' map to the design's states; copy is INSTAGRAM_COPY[source].
import type { Metadata } from "next";
import { Suspense } from "react";
import { BarList } from "@/components/BarList";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Message } from "@/components/Feedback";
import { Meter } from "@/components/Meter";
import { Pill } from "@/components/Pill";
import { ReelCard } from "@/components/ReelCard";
import { StatTile } from "@/components/StatTile";
import { CONTACT, INSTAGRAM_COPY, STATS_COPY } from "@/content/site";
import { getInstagramStats, INSTAGRAM_SOURCE_KIND } from "@/lib/instagram";
import type { InstagramStats } from "@/lib/instagram/types";
import {
  chartState,
  engagementBars,
  followerHistoryOf,
  followersTile,
  growthViews,
  percentMeter,
  reelViews,
  statusDate,
  statusView,
  totalTile,
  viewsBars,
  viewsTotalText,
} from "@/lib/instagram/view";
import main from "../main.module.css";
import { GrowthSection } from "./GrowthSection";
import { RetryButton } from "./RetryButton";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Stats",
};

const TILE_LABELS = [
  STATS_COPY.tileLabels.followers,
  STATS_COPY.tileLabels.views,
  STATS_COPY.tileLabels.likes,
  STATS_COPY.tileLabels.shares,
];

/** The whole screen. `stats` null = loading (Suspense fallback). */
function StatsBody({ stats }: { stats: InstagramStats | null }) {
  const copy = INSTAGRAM_COPY[stats?.source ?? INSTAGRAM_SOURCE_KIND];
  const status = stats ? statusView(stats) : null;
  const isError = stats?.status === "error";
  const hasData = stats != null && stats.status !== "empty";

  const tiles = stats
    ? [
        followersTile(stats),
        totalTile(stats, STATS_COPY.tileLabels.views, stats.totals.views, "views"),
        totalTile(stats, STATS_COPY.tileLabels.likes, stats.totals.likes, "likes"),
        totalTile(stats, STATS_COPY.tileLabels.shares, stats.totals.shares, "shares"),
      ]
    : null;

  const views = stats ? growthViews(followerHistoryOf(stats)) : null;
  const reels = stats ? reelViews(stats) : null;
  const engage = stats ? engagementBars(stats) : [];
  const topShare = stats ? percentMeter(stats.topReelShare) : null;
  const rate = stats ? percentMeter(stats.engagementRate) : null;

  return (
    <>
      <header className="mn-section__head">
        <div className={styles.heroCol}>
          <span className="mn-label">{STATS_COPY.eyebrow}</span>
          <h1 className="mn-display-lg">{STATS_COPY.title}</h1>
          <p className="mn-body-lg">{copy.heroLine}</p>
          <div className="mn-row">
            {status ? (
              <>
                <Pill variant={status.pillVariant}>{status.pillLabel}</Pill>
                <span className="mn-mono">{status.mono}</span>
              </>
            ) : (
              <Message tone="loading" as="span">
                {STATS_COPY.loadingHeadline}
              </Message>
            )}
          </div>
        </div>
        <Button variant="primary" href={CONTACT.instagram}>
          {STATS_COPY.follow}
        </Button>
      </header>

      {isError && stats ? (
        // The design puts role="alert" on this card; Message (tone error) already carries
        // role="alert", so the wrapper does not repeat it.
        <div className={`mn-card mn-card--inset ${styles.banner}`}>
          <Message tone="error" detail={`${STATS_COPY.errorBannerDetail} ${statusDate(stats)}.`}>
            {STATS_COPY.errorBanner}
          </Message>
          <RetryButton withIcon />
        </div>
      ) : null}

      <section className="mn-section" aria-label={STATS_COPY.headlineAria}>
        <div className={`mn-grid ${styles.tiles}`}>
          {tiles
            ? tiles.map((t) => (
                <StatTile
                  key={t.label}
                  label={t.label}
                  valueText={t.valueText}
                  title={t.title}
                  meta={t.meta}
                  metaKind={t.metaKind}
                  state={t.state}
                />
              ))
            : TILE_LABELS.map((l) => <StatTile key={l} label={l} state="loading" />)}
        </div>
      </section>

      <GrowthSection
        views={views}
        state={stats ? chartState(stats, views) : "loading"}
        errorAction={isError ? <RetryButton /> : undefined}
      />

      {hasData && stats && topShare && rate ? (
        <div className={styles.cards}>
          <Card as="section" className={styles.card} ariaLabel={STATS_COPY.viewsCard.title}>
            <div className="mn-card__row">
              <h2 className="mn-heading-sm">{STATS_COPY.viewsCard.title}</h2>
              <span className="mn-mono">{viewsTotalText(stats)}</span>
            </div>
            <Meter
              label={STATS_COPY.viewsCard.topShareLabel}
              ariaLabel={STATS_COPY.viewsCard.topShareAria}
              valueText={topShare.valueText}
              ratio={topShare.ratio}
              emptyReason={STATS_COPY.meterUnknownReason}
            />
            <BarList items={viewsBars(stats)} ariaLabel={STATS_COPY.viewsBarsAria} />
          </Card>
          <Card as="section" className={styles.card} ariaLabel={STATS_COPY.engageCard.title}>
            <div className="mn-card__row">
              <h2 className="mn-heading-sm">{STATS_COPY.engageCard.title}</h2>
              <span className="mn-mono">{STATS_COPY.engageCard.meta}</span>
            </div>
            <Meter
              label={STATS_COPY.engageCard.meterLabel}
              ariaLabel={STATS_COPY.engageCard.meterAria}
              valueText={rate.valueText}
              ratio={rate.ratio}
              emptyReason={STATS_COPY.meterUnknownReason}
            />
            <BarList
              items={engage}
              ariaLabel={STATS_COPY.engageBarsAria}
              state={engage.length === 0 ? "empty" : "ready"}
              emptyText={STATS_COPY.noEngagementYet}
            />
          </Card>
        </div>
      ) : null}

      <section className="mn-section">
        <div className="mn-section__head">
          <h2 className="mn-heading-md">{STATS_COPY.topReels.title}</h2>
          <span className="mn-mono">{STATS_COPY.topReels.meta}</span>
        </div>
        <div className={`mn-grid ${styles.reels}`}>
          {[0, 1, 2].map((i) => {
            if (!stats) return <ReelCard key={i} state="loading" />;
            const r = hasData ? reels?.reels[i] : undefined;
            if (!r) return <ReelCard key={i} state="empty" emptyText={STATS_COPY.topReels.emptySlot} />;
            return (
              <ReelCard
                key={i}
                rank={r.rank}
                viewsText={r.viewsText}
                viewsTitle={r.viewsTitle}
                href={CONTACT.instagram}
                thumbPlaceholder={r.thumbPlaceholder}
                engagement={r.engagement}
                engagementState={r.engagement.length === 0 ? "empty" : "ready"}
                engagementEmptyText={STATS_COPY.noReelEngagementYet}
                caption={r.caption}
              />
            );
          })}
        </div>
        {/* The shared-scale note only makes sense once a reel has engagement bars (item 9). */}
        {hasData && reels?.anyEngagement ? (
          <p className={`mn-mono ${styles.note}`}>{STATS_COPY.topReels.scaleNote}</p>
        ) : null}
      </section>

      <p className={`mn-mono ${styles.note}`}>{copy.sourceNote}</p>
    </>
  );
}

async function StatsData() {
  const stats = await getInstagramStats();
  return <StatsBody stats={stats} />;
}

export default function StatsPage() {
  return (
    <main className={main.main}>
      <Suspense fallback={<StatsBody stats={null} />}>
        <StatsData />
      </Suspense>
    </main>
  );
}
