"use client";
// Timeline (Timeline.md, Resume.dc.html): vertical, expandable resume timeline.
// Owns which entries are open (`defaultOpen`); the header button carries aria-expanded /
// aria-controls and the body is rendered only while open (as drawn).
// `current` = ongoing (blue ring); `dim` = filtered out by a skill Tag (fades, stays in place).
// Empty (a filter matched nothing): pass `emptyText` and a Feedback message shows above the list.
import { useState, type ReactNode } from "react";
import { Message } from "./Feedback";
import { ChevronDownIcon, NodeDotIcon } from "./icons";
import { cx } from "./types";

export type TimelineEntry = {
  id: string;
  title: string;
  sub: string;
  when: string;
  bullets: string[];
  /** Mono line under the bullets ("Supabase · GitHub Actions · Claude Code"). */
  stack?: string;
  current?: boolean;
  dim?: boolean;
};

export type TimelineProps = {
  entries: TimelineEntry[];
  /** Entry ids open on first render. */
  defaultOpen?: string[];
  emptyText?: ReactNode;
  className?: string;
};

export function Timeline({ entries, defaultOpen = [], emptyText, className }: TimelineProps) {
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(defaultOpen.map((id) => [id, true])),
  );

  return (
    <>
      {emptyText ? <Message>{emptyText}</Message> : null}
      <ol className={cx("mn-timeline", className)}>
        {entries.map((e) => {
          const isOpen = !!open[e.id];
          const bodyId = `tl-${e.id}`;
          return (
            <li key={e.id} className={cx("mn-tl", e.current && "is-current", e.dim && "is-dim")}>
              <span className="mn-tl__node">
                <NodeDotIcon />
              </span>
              <button
                type="button"
                className="mn-tl-head"
                aria-expanded={isOpen}
                aria-controls={bodyId}
                onClick={() => setOpen((o) => ({ ...o, [e.id]: !isOpen }))}
              >
                <span className="mn-tl__title">{e.title}</span>
                <span className="mn-tl__sub">{e.sub}</span>
                <span className="mn-tl__when">{e.when}</span>
                <ChevronDownIcon className="mn-tl__chev" />
              </button>
              {isOpen ? (
                <div className="mn-tl__body" id={bodyId}>
                  <ul>
                    {e.bullets.map((b, i) => (
                      <li key={i}>{b}</li>
                    ))}
                  </ul>
                  {e.stack ? <span className="mn-mono">{e.stack}</span> : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
    </>
  );
}
