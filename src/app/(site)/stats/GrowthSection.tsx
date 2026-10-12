"use client";
// Follower growth (Stats.dc.html): range tabs (default 90D) + the interactive Chart.
// Receives display-ready ChartViews per range (computed on the server); the tabs always
// render, even when there is no history (item 8). key={range} resets hover on a range change,
// like the design's setState({ range, hover: null }).
import { useState, type ReactNode } from "react";
import { Chart } from "@/components/Chart";
import { Tabs } from "@/components/Tabs";
import type { DataState } from "@/components/types";
import { STATS_COPY } from "@/content/site";
import type { FollowerRange } from "@/lib/instagram/types";
import type { ChartView } from "@/lib/instagram/view";
import styles from "./page.module.css";

export type GrowthSectionProps = {
  views: Partial<Record<FollowerRange, ChartView>> | null;
  state: DataState;
  /** Retry slot for the error state. */
  errorAction?: ReactNode;
};

const g = STATS_COPY.growth;

export function GrowthSection({ views, state, errorAction }: GrowthSectionProps) {
  const [range, setRange] = useState<FollowerRange>("90D");
  const view = views?.[range];
  const chartState: DataState = state === "ready" && !view ? "empty" : state;
  const ready = chartState === "ready" && view;

  return (
    <section className="mn-section">
      <div className="mn-section__head">
        <div className={styles.headCol}>
          <h2 className="mn-heading-md">{g.title}</h2>
          {ready ? <span className="mn-mono">{view.summary}</span> : null}
        </div>
        <Tabs
          ariaLabel={g.rangesAria}
          tabs={g.ranges.map((r) => ({ id: r, label: r }))}
          selected={range}
          onSelect={(id) => setRange(id as FollowerRange)}
        />
      </div>
      <Chart
        key={range}
        state={chartState}
        points={ready ? view.points : undefined}
        linePath={ready ? view.linePath : undefined}
        areaPath={ready ? view.areaPath : undefined}
        ticks={ready ? view.ticks : undefined}
        xLabels={ready ? view.xLabels : undefined}
        ariaLabel={ready ? view.ariaLabel : undefined}
        focusLabel={g.chartAria}
        loadingText={STATS_COPY.loadingChart}
        emptyText={STATS_COPY.chartEmpty}
        errorText={STATS_COPY.chartErrorTitle}
        errorDetail={STATS_COPY.chartErrorDetail}
        errorAction={errorAction}
      />
    </section>
  );
}
