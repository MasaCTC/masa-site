"use client";
// One class / category (prototype renderDetail): Upcoming by due date, No
// date, Done; the 8-color picker (radiogroup, arrow keys); "When things are
// due"; plus rename and delete (asks first with ConfirmDialog). NO_CLASS is the "No class" pseudo-group.
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Button } from "@/components/Button";
import { Message } from "@/components/Feedback";
import { cx } from "@/components/types";
import type { Class, Task } from "@/db/schema";
import { deleteClass, renameClass, setClassColor } from "@/lib/planner/actions";
import { CLASS_COLORS, type ClassColor } from "@/lib/planner/colors";
import { dayDiff, dueLabel, fmtDate } from "../_lib/dates";
import { fieldError } from "../_lib/errors";
import styles from "../planner.module.css";
import { Swatch } from "./bits";
import { CheckBox, TaskTitle } from "./Checklist";
import { ConfirmDialog } from "./ConfirmDialog";
import { usePlanner } from "./context";

export const NO_CLASS = "__none__";

const byDue = (a: Task, b: Task) => (a.dueDate! < b.dueDate! ? -1 : a.dueDate! > b.dueDate! ? 1 : 0);
const colorName = (c: string) => c[0].toUpperCase() + c.slice(1);

type Props = { cls: Class | typeof NO_CLASS; onBack: () => void };

export function ClassDetail({ cls, onBack }: Props) {
  const { tasks, today } = usePlanner();
  const real = cls === NO_CLASS ? null : cls;
  const backRef = useRef<HTMLButtonElement>(null);

  // Opening a detail puts focus on "← All classes" (prototype).
  useEffect(() => {
    backRef.current?.focus();
  }, []);

  const mine = tasks.filter((t) => (real ? t.classId === real.id : !t.classId));
  const upcoming = mine.filter((t) => !t.done && t.dueDate).sort(byDue);
  const noDate = mine.filter((t) => !t.done && !t.dueDate);
  const done = mine.filter((t) => t.done);
  const name = real ? real.name : "No class";

  return (
    <>
      <button type="button" ref={backRef} className={cx("mn-link", styles.backBtn)} onClick={onBack}>
        ← All classes
      </button>
      <div className="mn-section__head">
        <div className={styles.detailHeadCol}>
          <h2 className={cx("mn-display-lg", styles.detailTitle)}>
            <Swatch cls={real} />
            {name}
          </h2>
          <span className="mn-mono">
            {upcoming.length + noDate.length} open · {done.length} done
            {real?.kind === "class" && real.canvasCode ? " · synced from Canvas" : ""}
          </span>
        </div>
      </div>
      <div className={styles.detailGrid}>
        <div className={cx("mn-card", styles.gap14)}>
          <span className="mn-label">Upcoming · by due date</span>
          {upcoming.length ? (
            <TaskRows items={upcoming} today={today} label={`${name}: upcoming`} />
          ) : (
            <Message>Nothing with a due date.</Message>
          )}
          {noDate.length ? (
            <>
              <span className={cx("mn-label", styles.subLabel)}>No date</span>
              <TaskRows items={noDate} today={today} label={`${name}: no date`} />
            </>
          ) : null}
          {done.length ? (
            <>
              <span className={cx("mn-label", styles.subLabel)}>Done</span>
              <TaskRows items={done} today={today} label={`${name}: done`} />
            </>
          ) : null}
        </div>
        <div className={styles.aside}>
          {real ? <ColorCard cls={real} /> : null}
          <div className={cx("mn-card", styles.gap14)}>
            <span className="mn-label">When things are due</span>
            {upcoming.length ? (
              <ol className="mn-lanes-mini">
                {upcoming.map((t) => {
                  const days = dayDiff(today, t.dueDate!);
                  return (
                    <li key={t.id}>
                      <span className="mn-mono">{days <= 0 ? "today" : `${days}d`}</span>
                      <span className="mn-body-sm">{t.title}</span>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <Message>No dates yet.</Message>
            )}
          </div>
          {real ? <ManageCard key={real.id} cls={real} onDeleted={onBack} /> : null}
        </div>
      </div>
    </>
  );
}

function TaskRows({ items, today, label }: { items: Task[]; today: string; label: string }) {
  return (
    <ol className="mn-checklist" aria-label={label}>
      {items.map((t) => (
        <li key={t.id} className={cx("mn-check", styles.detailRow, t.done && "is-done")}>
          <CheckBox task={t} />
          <div className="mn-check__body">
            <TaskTitle task={t} />
            <span className="mn-check__meta">
              {[t.dueDate ? fmtDate(t.dueDate, { weekday: "short", month: "short", day: "numeric" }) : "no date", t.source === "canvas" ? "Canvas" : ""]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </div>
          <span className="mn-check__est">{t.dueDate ? dueLabel(t.dueDate, today).replace(/^due /, "") : ""}</span>
        </li>
      ))}
    </ol>
  );
}

function ColorCard({ cls }: { cls: Class }) {
  const { run, applyClass } = usePlanner();
  const labelId = useId();
  const refs = useRef(new Map<ClassColor, HTMLButtonElement>());

  const pick = (color: ClassColor) => {
    if (color === cls.color) return;
    run({
      optimistic: () => applyClass({ type: "color", id: cls.id, color }),
      call: () => setClassColor({ id: cls.id, color }),
      success: `${cls.name} is now ${colorName(color)}.`,
    });
  };

  // Radio group keys: arrows move and select, Home / End jump.
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const n = CLASS_COLORS.length;
    const to =
      e.key === "ArrowRight" || e.key === "ArrowDown"
        ? (i + 1) % n
        : e.key === "ArrowLeft" || e.key === "ArrowUp"
          ? (i - 1 + n) % n
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? n - 1
              : -1;
    if (to < 0) return;
    e.preventDefault();
    const color = CLASS_COLORS[to];
    refs.current.get(color)?.focus();
    pick(color);
  };

  return (
    <div className={cx("mn-card", styles.gap12)}>
      <span className="mn-label" id={labelId}>
        Color
      </span>
      <div className="mn-colors" role="radiogroup" aria-labelledby={labelId}>
        {CLASS_COLORS.map((c, i) => (
          <button
            key={c}
            type="button"
            ref={(el) => {
              if (el) refs.current.set(c, el);
              else refs.current.delete(c);
            }}
            className="mn-color"
            role="radio"
            aria-checked={c === cls.color}
            aria-label={colorName(c)}
            tabIndex={c === cls.color ? 0 : -1}
            style={{ "--c": `var(--cls-${c})` } as React.CSSProperties}
            onClick={() => pick(c)}
            onKeyDown={(e) => onKeyDown(e, i)}
          />
        ))}
      </div>
      <span className={cx("mn-body-sm", styles.muted)}>Shows on the checklist, calendar and this card.</span>
    </div>
  );
}

function ManageCard({ cls, onDeleted }: { cls: Class; onDeleted: () => void }) {
  const { run, applyClass } = usePlanner();
  const uid = useId();
  const [name, setName] = useState(cls.name);
  const [nameError, setNameError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const kind = cls.kind === "class" ? "class" : "category";

  const rename = (e: React.FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) {
      setNameError("Name is required");
      return;
    }
    if (n === cls.name) return;
    setNameError(null);
    run({
      optimistic: () => applyClass({ type: "rename", id: cls.id, name: n }),
      call: () => renameClass({ id: cls.id, name: n }),
      success: `Renamed to ${n}.`,
      onFail: (r) => {
        setName(cls.name);
        const msg = fieldError(r, "name");
        if (msg) {
          setName(n);
          setNameError(msg);
          return true;
        }
      },
    });
  };

  const remove = () => {
    // Back to the class list; ClassesView focuses the card, or its heading
    // once the card is gone.
    onDeleted();
    run({
      optimistic: () => applyClass({ type: "delete", id: cls.id }),
      call: () => deleteClass({ id: cls.id }),
      success: `Deleted ${cls.name}. Its tasks now have no class.`,
    });
  };

  return (
    <div className={cx("mn-card", styles.gap12)}>
      <form className={styles.modalForm} onSubmit={rename} autoComplete="off" noValidate>
        <div className="mn-field">
          <label className="mn-label" htmlFor={`${uid}-name`}>
            Name
          </label>
          <input
            className="mn-input"
            id={`${uid}-name`}
            value={name}
            maxLength={80}
            onChange={(e) => {
              setName(e.target.value);
              setNameError(null);
            }}
            aria-invalid={nameError ? true : undefined}
            aria-describedby={nameError ? `${uid}-err` : undefined}
          />
          {nameError ? (
            <span id={`${uid}-err`}>
              <Message tone="error" as="span">
                {nameError}
              </Message>
            </span>
          ) : null}
        </div>
        <div className="mn-row">
          <Button type="submit" size="sm">
            Rename
          </Button>
        </div>
      </form>
      <span className="mn-row">
        <Button size="sm" onClick={() => setConfirming(true)}>
          Delete {kind}
        </Button>
      </span>
      <ConfirmDialog
        open={confirming}
        title={`Delete "${cls.name}"?`}
        sentence="Its tasks stay, with no class."
        onClosed={() => setConfirming(false)}
        onConfirm={remove}
      />
    </div>
  );
}
