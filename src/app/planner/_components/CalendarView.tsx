"use client";
// Calendar (prototype "cal" panel): month (default) or week, Today / ← / →.
// Chips carry the class color and open the task modal; "+N more" in a month
// cell jumps to that week.
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/Button";
import { Tabs } from "@/components/Tabs";
import { cx } from "@/components/types";
import type { Task } from "@/db/schema";
import { addDays, addMonths, fmtDate, fmtMinutes, monthGrid, monthOf, weekStart } from "../_lib/dates";
import { isTemp } from "../_lib/tasks";
import styles from "../planner.module.css";
import { Swatch } from "./bits";
import { colorVar, usePlanner } from "./context";

type Mode = "week" | "month";
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const FULL_DAY = 480; // 8h fills the week view's load bar

export function CalendarView({ panelId, tabId }: { panelId: string; tabId: string }) {
  const { tasks, today, announce } = usePlanner();
  const [mode, setMode] = useState<Mode>("month");
  const [anchor, setAnchor] = useState(today);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const focusTitle = useRef(false);
  const lastTitle = useRef<string | null>(null);

  const byDay = new Map<string, Task[]>();
  for (const t of tasks) {
    if (!t.dueDate) continue;
    const list = byDay.get(t.dueDate);
    if (list) list.push(t);
    else byDay.set(t.dueDate, [t]);
  }

  const start = mode === "week" ? weekStart(anchor) : addMonths(anchor, 0);
  const title =
    mode === "week"
      ? `Week of ${fmtDate(start, { month: "short", day: "numeric" })}`
      : fmtDate(start, { month: "long", year: "numeric" });

  // A new range is spoken once: by focusing the title after "+N more", or
  // through the planner's live region after Today / ← / → / Week / Month.
  useEffect(() => {
    const changed = lastTitle.current !== null && lastTitle.current !== title;
    lastTitle.current = title;
    if (focusTitle.current) {
      focusTitle.current = false;
      titleRef.current?.focus();
    } else if (changed) announce(title);
  }, [title, announce]);

  const step = (dir: 1 | -1) => setAnchor((a) => (mode === "week" ? addDays(a, 7 * dir) : addMonths(a, dir)));
  const showWeek = (day: string) => {
    setMode("week");
    setAnchor(day);
    focusTitle.current = true;
  };

  return (
    <section id={panelId} role="tabpanel" aria-labelledby={tabId} className="mn-section">
      <div className="mn-section__head">
        <div className={cx("mn-row", styles.calTitleRow)}>
          <h2 className={cx("mn-heading-md", styles.calTitle)} ref={titleRef} tabIndex={-1}>
            {title}
          </h2>
          <Tabs
            ariaLabel="Calendar range"
            selected={mode}
            onSelect={(id) => setMode(id as Mode)}
            tabs={[
              { id: "week", label: "Week" },
              { id: "month", label: "Month" },
            ]}
          />
        </div>
        <div className="mn-row">
          <Button size="sm" onClick={() => setAnchor(today)}>
            Today
          </Button>
          <Button size="sm" ariaLabel={mode === "week" ? "Previous week" : "Previous month"} onClick={() => step(-1)}>
            ←
          </Button>
          <Button size="sm" ariaLabel={mode === "week" ? "Next week" : "Next month"} onClick={() => step(1)}>
            →
          </Button>
        </div>
      </div>

      {mode === "week" ? (
        <Week start={start} today={today} byDay={byDay} />
      ) : (
        <Month first={start} today={today} byDay={byDay} title={title} onMore={showWeek} />
      )}

      <p className={cx("mn-mono", styles.calNote)}>
        {mode === "week" ? (
          <>
            bar = estimated hours due that day (8h = full) · <ListedMark /> = on Today · click anything to add it to Today
          </>
        ) : (
          <>
            <ListedMark /> = on Today · click anything to add it to Today · go as far ahead as you like with →
          </>
        )}
      </p>
    </section>
  );
}

/** The check that marks a chip already on Today (prototype svg.mn-listed). */
function ListedMark() {
  return (
    <svg className="mn-listed" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M3 8.5 6.5 12 13 4.5" />
    </svg>
  );
}

function TaskOpener({ task, className, children, label }: { task: Task; className: string; children: React.ReactNode; label?: string }) {
  const { openTask, classById } = usePlanner();
  const cls = task.classId ? classById.get(task.classId) : undefined;
  // Unsaved (temp) tasks have no details to open yet.
  const temp = isTemp(task.id);
  return (
    <button
      type="button"
      className={className}
      style={colorVar(cls)}
      aria-label={label}
      disabled={temp}
      data-task-opener={temp ? undefined : task.id}
      onClick={() => openTask(task.id)}
    >
      {children}
    </button>
  );
}

function Week({ start, today, byDay }: { start: string; today: string; byDay: Map<string, Task[]> }) {
  const { classById } = usePlanner();
  return (
    <div className="mn-week">
      {Array.from({ length: 7 }, (_, i) => {
        const day = addDays(start, i);
        const items = byDay.get(day) ?? [];
        const minutes = items.reduce((sum, t) => sum + (t.estMinutes ?? 0), 0);
        const isToday = day === today;
        const dateText = fmtDate(day, { month: "short", day: "numeric" });
        const load = minutes ? `${fmtMinutes(minutes)} estimated` : "nothing estimated";
        return (
          <div
            key={day}
            className={cx("mn-day", isToday && "is-today")}
            role="group"
            aria-label={`${fmtDate(day, { weekday: "long", month: "long", day: "numeric" })}${isToday ? ", today" : ""}, ${items.length} due, ${load}`}
          >
            <div className="mn-day__head" aria-hidden="true">
              <b>{fmtDate(day, { weekday: "short" })}</b>
              <span className="mn-day__date">
                {dateText}
                {isToday ? " · today" : ""}
              </span>
            </div>
            <div className="mn-day__load" title={load} aria-hidden="true">
              <span style={{ width: `${Math.min(100, (minutes / FULL_DAY) * 100)}%` }} />
            </div>
            {items.map((t) => {
              const cls = t.classId ? classById.get(t.classId) : undefined;
              const meta = [t.estMinutes ? fmtMinutes(t.estMinutes) : "", t.onToday ? "on Today" : "", t.done ? "done" : ""].filter(Boolean);
              return (
                <TaskOpener key={t.id} task={t} className={cx("mn-due", t.onToday && "is-listed")}>
                  <b>
                    {t.onToday ? <ListedMark /> : null}
                    {t.title}
                  </b>
                  <span>
                    {cls ? (
                      <>
                        <Swatch cls={cls} />
                        {cls.name}
                      </>
                    ) : null}
                    {meta.map((m) => ` · ${m}`).join("")}
                  </span>
                </TaskOpener>
              );
            })}
            {items.length ? null : <span className={cx("mn-mono", styles.nothingDue)}>nothing due</span>}
          </div>
        );
      })}
    </div>
  );
}

type MonthProps = {
  first: string;
  today: string;
  byDay: Map<string, Task[]>;
  title: string;
  onMore: (day: string) => void;
};

function Month({ first, today, byDay, title, onMore }: MonthProps) {
  const { classById } = usePlanner();
  const month = monthOf(first);
  return (
    <div className="mn-month" role="group" aria-label={title}>
      {DOW.map((d) => (
        <span key={d} className="mn-month__dow" aria-hidden="true">
          {d}
        </span>
      ))}
      {monthGrid(first).map((day) => {
        const items = byDay.get(day) ?? [];
        const out = monthOf(day) !== month;
        const isToday = day === today;
        return (
          <div
            key={day}
            className={cx("mn-cell", out && "is-out", isToday && "is-today")}
            role="group"
            aria-label={`${fmtDate(day, { weekday: "long", month: "long", day: "numeric" })}${isToday ? ", today" : ""}, ${items.length} due`}
          >
            <span className="mn-cell__n" aria-hidden="true">
              {Number(day.slice(8))}
            </span>
            {items.slice(0, 3).map((t) => {
              const cls = t.classId ? classById.get(t.classId) : undefined;
              return (
                <TaskOpener
                  key={t.id}
                  task={t}
                  className={cx("mn-cell__item", t.done && "is-done", t.onToday && "is-listed")}
                  label={`${t.title}${cls ? `, ${cls.name}` : ""}${t.done ? ", done" : ""}${t.onToday ? ", on Today" : ""}. Open details`}
                >
                  <Swatch cls={cls} />
                  <span className="t">
                    {t.onToday ? <ListedMark /> : null}
                    {t.title}
                  </span>
                </TaskOpener>
              );
            })}
            {items.length > 3 ? (
              <button
                type="button"
                className={cx("mn-cell__more mn-link", styles.moreBtn)}
                aria-label={`${items.length - 3} more on ${fmtDate(day, { month: "long", day: "numeric" })}. Show the week`}
                onClick={() => onMore(day)}
              >
                +{items.length - 3} more
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
