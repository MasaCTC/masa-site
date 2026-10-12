"use client";
// Classes (prototype "classes" panel): cards grouped as Classes (from Canvas)
// and Categories (yours), plus "No class" when anything has no class. A card
// opens the class detail; "New category" opens a small create dialog.
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/Button";
import { Message } from "@/components/Feedback";
import { cx } from "@/components/types";
import type { Class, Task } from "@/db/schema";
import { createClass } from "@/lib/planner/actions";
import { leastUsedColor } from "@/lib/planner/colors";
import { dueLabel } from "../_lib/dates";
import { fieldError } from "../_lib/errors";
import { isTemp, TEMP_PREFIX } from "../_lib/tasks";
import styles from "../planner.module.css";
import { ClassDetail, NO_CLASS } from "./ClassDetail";
import { usePlanner } from "./context";

type Props = { panelId: string; tabId: string };

export function ClassesView({ panelId, tabId }: Props) {
  const { classes, tasks } = usePlanner();
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const headRef = useRef<HTMLHeadingElement>(null);
  const cardRefs = useRef(new Map<string, HTMLButtonElement>());
  // After leaving a detail view, focus its card (or the heading if it is gone).
  const returnTo = useRef<string | null>(null);

  useEffect(() => {
    if (openId !== null || returnTo.current === null) return;
    const card = cardRefs.current.get(returnTo.current);
    returnTo.current = null;
    (card ?? headRef.current)?.focus();
  }, [openId]);

  const open = openId === null ? null : openId === NO_CLASS ? NO_CLASS : classes.find((c) => c.id === openId);
  const close = () => {
    returnTo.current = openId;
    setOpenId(null);
  };

  if (openId !== null && open) {
    return (
      <section id={panelId} role="tabpanel" aria-labelledby={tabId} className="mn-section">
        <ClassDetail cls={open} onBack={close} />
      </section>
    );
  }

  const noClass = tasks.filter((t) => !t.classId);
  const groups: Array<{ kind: Class["kind"]; label: string; note: string }> = [
    { kind: "class", label: "Classes", note: "from Canvas" },
    { kind: "category", label: "Categories", note: "yours" },
  ];
  const cardRef = (id: string) => (el: HTMLButtonElement | null) => {
    if (el) cardRefs.current.set(id, el);
    else cardRefs.current.delete(id);
  };

  return (
    <section id={panelId} role="tabpanel" aria-labelledby={tabId} className="mn-section">
      <div className="mn-section__head">
        <h2 className={cx("mn-heading-md", styles.headFocus)} ref={headRef} tabIndex={-1}>
          Classes and categories
        </h2>
        <Button onClick={() => setCreating(true)}>New category</Button>
      </div>
      <div className={styles.classList}>
        {groups.map((g) => {
          const items = classes.filter((c) => c.kind === g.kind);
          const showNone = g.kind === "category" && noClass.length > 0;
          return (
            <div key={g.kind} className={styles.classGroup}>
              <div className={styles.classGroupHead}>
                <h3 className="mn-label">{g.label}</h3>
                <span className="mn-mono">{g.note}</span>
              </div>
              {items.length || showNone ? (
                <div className="mn-grid">
                  {items.map((c) => (
                    <ClassCard
                      key={c.id}
                      name={c.name}
                      items={tasks.filter((t) => t.classId === c.id)}
                      disabled={isTemp(c.id)}
                      buttonRef={cardRef(c.id)}
                      onOpen={() => setOpenId(c.id)}
                    />
                  ))}
                  {showNone ? (
                    <ClassCard
                      name="No class"
                      items={noClass}
                      buttonRef={cardRef(NO_CLASS)}
                      onOpen={() => setOpenId(NO_CLASS)}
                    />
                  ) : null}
                </div>
              ) : (
                <Message icon="box">
                  {g.kind === "class"
                    ? "No classes yet. Connect Canvas in Settings to bring them in."
                    : "No categories yet. Add one with New category."}
                </Message>
              )}
            </div>
          );
        })}
      </div>
      <NewCategoryDialog open={creating} onClosed={() => setCreating(false)} />
    </section>
  );
}

type CardProps = {
  name: string;
  items: Task[];
  disabled?: boolean;
  buttonRef: (el: HTMLButtonElement | null) => void;
  onOpen: () => void;
};

function ClassCard({ name, items, disabled, buttonRef, onOpen }: CardProps) {
  const { today } = usePlanner();
  const open = items.filter((t) => !t.done);
  const next = open
    .filter((t) => t.dueDate)
    .sort((a, b) => (a.dueDate! < b.dueDate! ? -1 : a.dueDate! > b.dueDate! ? 1 : 0))[0];
  return (
    <button
      type="button"
      ref={buttonRef}
      className={cx("mn-card mn-card--link", styles.classCard)}
      aria-label={`Open ${name}: ${open.length} open`}
      disabled={disabled}
      onClick={onOpen}
    >
      <span className="mn-heading-sm">{name}</span>
      <span className={styles.classCardCount}>
        <b>{open.length}</b> open
        {next?.dueDate ? <span className="mn-mono"> · next {dueLabel(next.dueDate, today)}</span> : null}
      </span>
      {open.length ? (
        <span className={styles.classCardList}>
          {open.slice(0, 3).map((t) => (
            <span key={t.id} className="mn-body-sm">
              {t.title}
            </span>
          ))}
          {open.length > 3 ? <span className="mn-mono">+{open.length - 3} more</span> : null}
        </span>
      ) : (
        <span className={cx("mn-body-sm", styles.subtle)}>Nothing open.</span>
      )}
    </button>
  );
}

let tempSeq = 0;

function NewCategoryDialog({ open, onClosed }: { open: boolean; onClosed: () => void }) {
  const { classes, run, applyClass } = usePlanner();
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const uid = useId();
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);

  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    if (open && !dlg.open) {
      opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dlg.showModal();
    } else if (!open && dlg.open) dlg.close();
  }, [open]);

  const onClose = () => {
    setName("");
    setNameError(null);
    onClosed();
    const el = opener.current;
    opener.current = null;
    if (el?.isConnected) el.focus();
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) {
      setNameError("Name is required");
      return;
    }
    const color = leastUsedColor(classes.map((c) => c.color));
    const temp: Class = {
      id: `${TEMP_PREFIX}c${++tempSeq}`,
      name: n,
      kind: "category",
      color,
      canvasCode: null,
      createdAt: new Date(),
    };
    run({
      optimistic: () => applyClass({ type: "add", cls: temp }),
      call: () => createClass({ name: n, kind: "category" }),
      success: `Added category ${n}.`,
      onOk: () => ref.current?.close(),
      onFail: (r) => {
        const msg = fieldError(r, "name");
        if (msg) {
          setNameError(msg);
          return true;
        }
        ref.current?.close();
      },
    });
  };

  return (
    <dialog
      ref={ref}
      className="mn-modal"
      aria-labelledby={`${uid}-title`}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) e.currentTarget.close();
      }}
    >
      {open ? (
        <form className="mn-modal__in" autoComplete="off" onSubmit={submit} noValidate>
          <div className="mn-modal__head">
            <h2 className="mn-heading-md" id={`${uid}-title`}>
              New category
            </h2>
          </div>
          <div className="mn-field">
            <label className="mn-label" htmlFor={`${uid}-name`}>
              Name
            </label>
            <input
              className="mn-input"
              id={`${uid}-name`}
              value={name}
              maxLength={80}
              autoFocus
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
          <p className="mn-body-sm">Categories are yours (Cofura, Instagram, Personal). Classes come from Canvas.</p>
          <div className="mn-row">
            <Button type="submit" variant="primary">
              Add category
            </Button>
            <button type="button" className={cx("mn-link", styles.closeLink)} onClick={() => ref.current?.close()}>
              Cancel
            </button>
          </div>
        </form>
      ) : null}
    </dialog>
  );
}
