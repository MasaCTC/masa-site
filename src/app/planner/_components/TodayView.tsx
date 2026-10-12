"use client";
// Today: the running checklist (with quick add) beside the public status and
// the "Due next 3 days" bars.
import { useRef } from "react";
import { BarList } from "@/components/BarList";
import { Message } from "@/components/Feedback";
import { Meter } from "@/components/Meter";
import { cx } from "@/components/types";
import type { DueSoonRow } from "@/lib/planner/queries";
import { fmtMinutes } from "../_lib/dates";
import { onTodaysList } from "../_lib/tasks";
import styles from "../planner.module.css";
import { AddForm } from "./AddForm";
import { Checklist } from "./Checklist";
import { usePlanner } from "./context";
import { StatusCard } from "./StatusCard";

type Props = { panelId: string; tabId: string; dueSoon: DueSoonRow[] };

export function TodayView({ panelId, tabId, dueSoon }: Props) {
  const { tasks, today } = usePlanner();
  const addRef = useRef<HTMLInputElement>(null);
  const items = tasks.filter((t) => onTodaysList(t, today));
  const done = items.filter((t) => t.done).length;
  const left = items.reduce((sum, t) => sum + (!t.done && t.estMinutes ? t.estMinutes : 0), 0);
  const ratio = items.length ? done / items.length : undefined;

  const maxDue = dueSoon[0]?.minutes ?? 0;

  return (
    <section id={panelId} role="tabpanel" aria-labelledby={tabId} className={styles.todayGrid}>
      <div className={cx("mn-card mn-card--lg", styles.todayCard)}>
        <div className="mn-card__row">
          <h2 className="mn-heading-md">Running checklist</h2>
          <span className="mn-mono">
            {done} of {items.length} done
          </span>
        </div>
        <Meter
          label="Today"
          valueText={left ? `~${fmtMinutes(left)} estimated left` : "no estimates"}
          ratio={ratio}
          ariaLabel={`Today: ${done} of ${items.length} done`}
        />
        <AddForm inputRef={addRef} />
        {items.length ? (
          <>
            <div className="mn-prio" aria-hidden="true">
              <span>↑ most important</span>
              <span>drag to reorder · or focus ⋮⋮ and use ↑ ↓</span>
            </div>
            <Checklist items={items} fallbackFocus={addRef} />
            <div className="mn-prio" aria-hidden="true">
              <span>↓ meh</span>
              <span />
            </div>
          </>
        ) : (
          <Message icon="box">Nothing on the list. Add a task, or connect Canvas in Settings.</Message>
        )}
      </div>

      <aside className={styles.aside}>
        <StatusCard />
        <div className={cx("mn-card", styles.gap16)}>
          <div className="mn-card__row">
            <span className="mn-label">Due next 3 days</span>
            <span className="mn-mono">by hours</span>
          </div>
          <BarList
            ariaLabel="Hours due per class, next 3 days"
            state={dueSoon.length ? "ready" : "empty"}
            emptyText="Nothing with an estimate is due in the next 3 days."
            items={dueSoon.map((r, i) => ({
              label: r.name,
              valueText: fmtMinutes(r.minutes),
              title: `${r.name} · ${fmtMinutes(r.minutes)} estimated`,
              ratio: maxDue ? r.minutes / maxDue : undefined,
              top: i === 0,
            }))}
          />
        </div>
      </aside>
    </section>
  );
}
