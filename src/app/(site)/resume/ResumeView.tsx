"use client";
// Resume interactive island (Resume.dc.html): the Timeline / $ terminal tabs, the skill-tag
// filter (drives both the timeline and the time lanes), the expandable timeline and the
// terminal. Receives finished, display-ready content from the server page (the Instagram
// entry's stack is already filled), plus the server-rendered header row and Education card.
import { useState, type ReactNode } from "react";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Message } from "@/components/Feedback";
import { Link } from "@/components/Link";
import { Tabs } from "@/components/Tabs";
import { Tag, TagGroup } from "@/components/Tag";
import { Terminal } from "@/components/Terminal";
import { TimeLanes } from "@/components/TimeLanes";
import { Timeline, type TimelineEntry } from "@/components/Timeline";
import {
  DEFAULT_OPEN,
  ENTRY_GROUPS,
  LANE_TICKS,
  LANES,
  LANES_ARIA,
  LANES_NOW,
  RESUME_PAGE,
  SKILL_GROUPS,
  SKILLS_CARD,
  TERMINAL_CHIPS,
  TERMINAL_CLEAR_HINT,
  TERMINAL_INITIAL_LOG,
  TERMINAL_RESPONSES,
  filterMessage,
} from "@/content/resume";
import styles from "./page.module.css";

/** A timeline entry plus the skill keys it matches. */
export type ResumeViewEntry = Omit<TimelineEntry, "dim"> & { tags: string[] };

export type ResumeViewProps = {
  /** Server-rendered mn-section__head (eyebrow, h1, Download PDF, Email me). */
  head: ReactNode;
  /** Server-rendered Education card. */
  education: ReactNode;
  entries: ResumeViewEntry[];
};

type View = "timeline" | "terminal";
const PANEL_ID: Record<View, string> = { timeline: "resume-timeline", terminal: "resume-terminal" };
const TAB_ID: Record<View, string> = { timeline: "resume-tab-timeline", terminal: "resume-tab-terminal" };

export function ResumeView({ head, education, entries }: ResumeViewProps) {
  const [view, setView] = useState<View>("timeline");
  const [filter, setFilter] = useState<string | null>(null);

  const dimmed = (tags: readonly string[]) => filter != null && !tags.includes(filter);
  // Matches count timeline entries only (design: E.filter(...)), so a skill that only lights
  // the UC Irvine lane (Python) still reads "Nothing on here uses Python yet."
  const matches = filter == null ? 0 : entries.filter((e) => e.tags.includes(filter)).length;
  const byId = new Map(entries.map((e) => [e.id, e]));

  return (
    <>
      <header className={styles.header}>
        {head}
        <Tabs
          className={styles.tabs}
          ariaLabel={RESUME_PAGE.tabsAria}
          tabs={[
            { id: "timeline", label: RESUME_PAGE.tabs.timeline, controls: PANEL_ID.timeline, domId: TAB_ID.timeline },
            { id: "terminal", label: RESUME_PAGE.tabs.terminal, mono: true, controls: PANEL_ID.terminal, domId: TAB_ID.terminal },
          ]}
          selected={view}
          onSelect={(id) => setView(id as View)}
        />
      </header>

      <div id={PANEL_ID.timeline} role="tabpanel" aria-labelledby={TAB_ID.timeline} className={styles.layout} hidden={view !== "timeline"}>
        <div className={styles.col}>
          <Card as="section" className={styles.glance} ariaLabel={RESUME_PAGE.glance.title}>
            <div className="mn-card__row">
              <h2 className="mn-heading-sm">{RESUME_PAGE.glance.title}</h2>
              <span className="mn-mono">{RESUME_PAGE.glance.legend}</span>
            </div>
            <TimeLanes
              ariaLabel={LANES_ARIA}
              ticks={[...LANE_TICKS]}
              now={LANES_NOW}
              lanes={LANES.map(({ tags, ...lane }) => ({ ...lane, dim: dimmed(tags) }))}
            />
          </Card>

          {filter != null ? (
            <div className={`mn-card mn-card--inset ${styles.filter}`}>
              <Message as="span">{filterMessage(filter, matches)}</Message>
              <Button variant="ghost" size="sm" onClick={() => setFilter(null)}>
                {RESUME_PAGE.showEverything}
              </Button>
            </div>
          ) : null}

          {ENTRY_GROUPS.map((g) => (
            <section key={g.title} className={styles.group} aria-label={g.title}>
              <div className="mn-card__row">
                <h2 className={`mn-heading-md ${styles.groupTitle}`}>{g.title}</h2>
                <span className="mn-mono">{g.count}</span>
              </div>
              <Timeline
                defaultOpen={DEFAULT_OPEN}
                entries={g.ids.flatMap((id) => {
                  const e = byId.get(id);
                  if (!e) return [];
                  const { tags, ...entry } = e;
                  return [{ ...entry, dim: dimmed(tags) }];
                })}
              />
            </section>
          ))}
        </div>

        <aside className={styles.aside}>
          {education}
          <Card as="section" className={styles.skills} ariaLabel={SKILLS_CARD.label}>
            <div className={styles.skillsHead}>
              <span className="mn-label">{SKILLS_CARD.label}</span>
              <span className="mn-body-sm">{SKILLS_CARD.hint}</span>
            </div>
            {SKILL_GROUPS.map((sg) => (
              <div key={sg.label} className={styles.skillGroup}>
                <span className={`mn-label ${styles.skillLabel}`}>{sg.label}</span>
                <TagGroup ariaLabel={sg.label} size="sm">
                  {sg.tags.map((t) => (
                    <Tag
                      key={t.key}
                      size="sm"
                      pressed={filter === t.key}
                      onClick={() => setFilter(filter === t.key ? null : t.key)}
                    >
                      {t.label}
                    </Tag>
                  ))}
                </TagGroup>
                {sg.more ? <span className="mn-body-sm">{sg.more}</span> : null}
              </div>
            ))}
          </Card>
        </aside>
      </div>

      <div id={PANEL_ID.terminal} role="tabpanel" aria-labelledby={TAB_ID.terminal} className={styles.panel} hidden={view !== "terminal"}>
        <Terminal
          initialLog={TERMINAL_INITIAL_LOG}
          responses={TERMINAL_RESPONSES}
          chips={TERMINAL_CHIPS}
          clearHint={TERMINAL_CLEAR_HINT}
        />
        <p className={`mn-body-sm ${styles.back}`}>
          {RESUME_PAGE.terminalBack.before}
          <Link onClick={() => setView("timeline")}>{RESUME_PAGE.terminalBack.link}</Link>
        </p>
      </div>
    </>
  );
}
