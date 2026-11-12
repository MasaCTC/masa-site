"use client";
// Public status (StatusLine.md): pick Studying / Building / Free, preview what
// visitors see on /now, then "Update status" (setStatus). "Show on /now" on a
// task sets it from the task instead.
import { useId, useState } from "react";
import { Button } from "@/components/Button";
import { Message } from "@/components/Feedback";
import { Link } from "@/components/Link";
import { Tabs } from "@/components/Tabs";
import { cx } from "@/components/types";
import { setStatus } from "@/lib/planner/actions";
import type { StatusView } from "@/lib/planner/queries";
import { statusText, type StatusMode } from "@/lib/planner/status";
import { PLANNER_TZ, plannerToday } from "@/lib/planner/time";
import { fieldError } from "../_lib/errors";
import styles from "../planner.module.css";
import { usePlanner } from "./context";

const MODES: Array<{ id: StatusMode; label: string }> = [
  { id: "study", label: "Studying" },
  { id: "build", label: "Building" },
  { id: "free", label: "Free" },
];

/** "2:10 PM" today, "Oct 11, 2:10 PM" before that (owner's timezone). */
function sinceText(since: Date | null, today: string): string | null {
  if (!since) return null;
  const d = new Date(since);
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: PLANNER_TZ });
  if (plannerToday(d) === today) return time;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: PLANNER_TZ }) + ", " + time;
}

function draftFrom(status: StatusView, firstClassId: string) {
  return {
    mode: status.mode,
    classId: status.mode === "study" && status.classId ? status.classId : firstClassId,
    text: status.mode === "build" ? (status.text ?? "") : "",
  };
}

export function StatusCard() {
  const { status, classes, today, run } = usePlanner();
  const uid = useId();
  const studyClasses = classes.filter((c) => c.kind === "class");
  const firstClassId = studyClasses[0]?.id ?? "";
  const [draft, setDraft] = useState(() => draftFrom(status, firstClassId));
  const [textError, setTextError] = useState<string | null>(null);
  // When the saved status changes (Update status, "Show on /now"), start the
  // draft over from it. Adjusting state during render keeps focus in place.
  const savedKey = `${status.mode}|${status.classId}|${status.text}|${String(status.since)}`;
  const [seenKey, setSeenKey] = useState(savedKey);
  if (seenKey !== savedKey) {
    setSeenKey(savedKey);
    setDraft(draftFrom(status, firstClassId));
    setTextError(null);
  }

  const classId = studyClasses.some((c) => c.id === draft.classId) ? draft.classId : firstClassId;
  const className = studyClasses.find((c) => c.id === classId)?.name ?? null;
  const preview = statusText({ mode: draft.mode, text: draft.text.trim() || null, className });
  const noClass = draft.mode === "study" && !classId;
  const since = sinceText(status.since, today);

  const update = () => {
    const input =
      draft.mode === "study"
        ? ({ mode: "study", classId } as const)
        : draft.mode === "build"
          ? ({ mode: "build", text: draft.text } as const)
          : ({ mode: "free" } as const);
    setTextError(null);
    run({
      call: () => setStatus(input),
      success: "Status updated.",
      onFail: (r) => {
        const msg = fieldError(r, "text");
        if (msg) {
          setTextError(msg);
          return true;
        }
      },
    });
  };

  return (
    <div className={cx("mn-card", styles.gap16)}>
      <div className="mn-card__row">
        <span className="mn-label">Public status</span>
        <Link href="/now">See /now</Link>
      </div>
      <Tabs
        ariaLabel="Status type"
        className={styles.tabs}
        selected={draft.mode}
        onSelect={(id) => setDraft((d) => ({ ...d, mode: id as StatusMode }))}
        tabs={MODES}
      />
      {draft.mode === "study" ? (
        <div className="mn-field">
          <label className="mn-label" htmlFor={`${uid}-class`}>
            Studying for
          </label>
          {studyClasses.length ? (
            <select
              className="mn-select"
              id={`${uid}-class`}
              value={classId}
              onChange={(e) => setDraft((d) => ({ ...d, classId: e.target.value }))}
            >
              {studyClasses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          ) : (
            <Message icon="box">No classes yet. Add one in Classes, or connect Canvas in Settings.</Message>
          )}
        </div>
      ) : null}
      {draft.mode === "build" ? (
        <div className="mn-field">
          <label className="mn-label" htmlFor={`${uid}-text`}>
            Building
          </label>
          <input
            className="mn-input"
            id={`${uid}-text`}
            value={draft.text}
            maxLength={120}
            onChange={(e) => {
              setDraft((d) => ({ ...d, text: e.target.value }));
              setTextError(null);
            }}
            aria-invalid={textError ? true : undefined}
            aria-describedby={textError ? `${uid}-text-err` : undefined}
          />
          {textError ? (
            <span id={`${uid}-text-err`}>
              <Message tone="error" as="span">
                {textError}
              </Message>
            </span>
          ) : null}
        </div>
      ) : null}
      <div className={cx("mn-card mn-card--inset", styles.preview)}>
        <span className="mn-label">Visitors will see</span>
        <div className={cx("mn-status", draft.mode === "free" && "is-free")}>
          <span className="mn-status__dot" />
          <span className={cx("mn-status__text", styles.previewText)}>{preview}</span>
        </div>
      </div>
      <div className="mn-row">
        <Button onClick={update} disabled={noClass}>
          Update status
        </Button>
        {since ? <span className="mn-mono">live since {since}</span> : null}
      </div>
      <p className="mn-body-sm">
        Task titles stay private. Use &quot;Show on /now&quot; on a task to make it the status instead.
      </p>
    </div>
  );
}
