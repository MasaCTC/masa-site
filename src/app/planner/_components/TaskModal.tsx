"use client";
// Task details (prototype #taskModal): a native <dialog class="mn-modal">
// opened from a task title anywhere in the planner. Facts, Mark done / open,
// Show on /now, plus Edit (editTask) and Delete (with a confirm step).
// Escape, the x, Close and a backdrop click all close it; focus goes back to
// whatever opened it.
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/Button";
import { Message } from "@/components/Feedback";
import { cx } from "@/components/types";
import type { Task } from "@/db/schema";
import { deleteTask, editTask, setStatus, toggleDone } from "@/lib/planner/actions";
import { dueLabel, fmtDate, fmtMinutes } from "../_lib/dates";
import { onTodaysList } from "../_lib/tasks";
import styles from "../planner.module.css";
import { ClassOptions, EST_OPTIONS, Swatch, XIcon } from "./bits";
import { colorVar, usePlanner } from "./context";

type Props = { task: Task | undefined; onClosed: () => void };

export function TaskModal({ task, onClosed }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const open = Boolean(task);

  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    if (open && !dlg.open) {
      opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dlg.showModal();
    } else if (!open && dlg.open) {
      // The task went away (deleted here or elsewhere).
      dlg.close();
    }
  }, [open]);

  const onClose = () => {
    onClosed();
    const el = opener.current;
    opener.current = null;
    if (el?.isConnected) el.focus();
  };

  return (
    <dialog
      ref={ref}
      className="mn-modal"
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        // A click on the dialog box itself (not its content) is the backdrop.
        if (e.target === e.currentTarget) e.currentTarget.close();
      }}
    >
      {task ? (
        <ModalBody key={task.id} task={task} titleId={titleId} close={() => ref.current?.close()} />
      ) : null}
    </dialog>
  );
}

type BodyProps = { task: Task; titleId: string; close: () => void };

function ModalBody({ task, titleId, close }: BodyProps) {
  const { today, tasks, classById, status, run, applyTask, error } = usePlanner();
  const [mode, setMode] = useState<"view" | "edit" | "confirm">("view");
  // Leaving Edit / the delete confirm puts focus back on the button that started it.
  const editBtn = useRef<HTMLSpanElement>(null);
  const deleteBtn = useRef<HTMLSpanElement>(null);
  const back = useRef<"edit" | "delete" | null>(null);
  useEffect(() => {
    if (mode !== "view" || !back.current) return;
    const wrap = back.current === "edit" ? editBtn.current : deleteBtn.current;
    back.current = null;
    wrap?.querySelector("button")?.focus();
  }, [mode]);
  const toView = (from: "edit" | "delete") => {
    back.current = from;
    setMode("view");
  };
  const cls = task.classId ? classById.get(task.classId) : undefined;
  const list = tasks.filter((t) => onTodaysList(t, today));
  const pos = list.findIndex((t) => t.id === task.id);
  const onNow = status.mode === "build" && status.taskId === task.id;
  const canvasUrl = task.canvasUrl && /^https?:\/\//i.test(task.canvasUrl) ? task.canvasUrl : null;

  const toggle = () => {
    const done = !task.done;
    run({
      optimistic: () => applyTask({ type: "toggle", id: task.id, done, at: new Date() }),
      call: () => toggleDone({ id: task.id, done }),
      success: done ? `Marked done: ${task.title}` : `Marked open: ${task.title}`,
    });
  };

  const showOnNow = () => {
    close();
    run({ call: () => setStatus({ taskId: task.id }), success: `Status set to: Building ${task.title}` });
  };

  const remove = () => {
    // Removing the task closes the dialog (the effect above).
    run({
      optimistic: () => applyTask({ type: "delete", id: task.id }),
      call: () => deleteTask({ id: task.id }),
      success: `Deleted ${task.title}.`,
    });
  };

  return (
    <div className="mn-modal__in" style={colorVar(cls)}>
      <div className="mn-modal__head">
        <div className={styles.modalTitleCol}>
          <span className="mn-label">
            {cls ? (
              <>
                <Swatch cls={cls} />
                {cls.name}
              </>
            ) : (
              "No class"
            )}
          </span>
          <h2 className="mn-heading-md" id={titleId}>
            {task.title}
          </h2>
        </div>
        <button type="button" className="mn-check__x" aria-label="Close" onClick={close}>
          <XIcon />
        </button>
      </div>

      {error ? (
        <Message tone="error" detail={error.detail}>
          {error.lead}
        </Message>
      ) : null}

      {mode === "edit" ? (
        <EditForm task={task} onDone={() => toView("edit")} />
      ) : (
        <>
          <dl className="mn-facts">
            <dt>Due</dt>
            <dd>
              {task.dueDate ? (
                <>
                  {fmtDate(task.dueDate, { weekday: "long", month: "long", day: "numeric" })}{" "}
                  <span className="mn-mono">· {dueLabel(task.dueDate, today).replace(/^due /, "")}</span>
                </>
              ) : (
                "No date"
              )}
            </dd>
            <dt>Estimate</dt>
            <dd>{task.estMinutes ? fmtMinutes(task.estMinutes) : "None"}</dd>
            <dt>Priority</dt>
            <dd>{pos >= 0 ? `#${pos + 1} of ${list.length} on the checklist` : "Not on the checklist"}</dd>
            <dt>Source</dt>
            <dd>
              {task.source === "canvas" ? (
                <>
                  Canvas
                  {canvasUrl ? (
                    <>
                      {" · "}
                      <a className="mn-link" href={canvasUrl} target="_blank" rel="noopener noreferrer">
                        Open in Canvas ↗
                      </a>
                    </>
                  ) : null}
                </>
              ) : (
                "Added by you"
              )}
            </dd>
            <dt>Status</dt>
            <dd>{task.done ? "Done" : onNow ? "Open · on /now" : "Open"}</dd>
          </dl>

          {mode === "confirm" ? (
            <div className="mn-row" role="group" aria-label="Confirm delete">
              <span>Delete this task for good?</span>
              <Button size="sm" onClick={remove}>Delete</Button>
              <button type="button" className={cx("mn-link", styles.closeLink)} onClick={() => toView("delete")}>
                Keep it
              </button>
            </div>
          ) : (
            <div className="mn-row">
              <Button size="sm" onClick={toggle}>{task.done ? "Mark open" : "Mark done"}</Button>
              {task.done || onNow ? null : <Button size="sm" onClick={showOnNow}>Show on /now</Button>}
              <span ref={editBtn} className={styles.contents}>
                <Button size="sm" onClick={() => setMode("edit")}>Edit</Button>
              </span>
              <span ref={deleteBtn} className={styles.contents}>
                <Button size="sm" onClick={() => setMode("confirm")}>Delete</Button>
              </span>
              <button type="button" className={cx("mn-link", styles.closeLink)} onClick={close}>
                Close
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function EditForm({ task, onDone }: { task: Task; onDone: () => void }) {
  const { classes, run, applyTask } = usePlanner();
  const uid = useId();
  const [title, setTitle] = useState(task.title);
  const [classId, setClassId] = useState(task.classId ?? "");
  const [due, setDue] = useState(task.dueDate ?? "");
  const [est, setEst] = useState(task.estMinutes ? String(task.estMinutes) : "");
  const [titleError, setTitleError] = useState<string | null>(null);
  // Keep an estimate that is not one of the presets (e.g. 45m) selectable.
  const estOptions =
    est && !EST_OPTIONS.some(([v]) => v === est) ? [...EST_OPTIONS, [est, fmtMinutes(Number(est))] as [string, string]] : EST_OPTIONS;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = title.trim();
    if (!t) {
      setTitleError("Give the task a title.");
      return;
    }
    const patch = { title: t, classId: classId || null, dueDate: due || null, estMinutes: est ? Number(est) : null };
    setTitleError(null);
    onDone();
    run({
      optimistic: () => applyTask({ type: "edit", id: task.id, patch }),
      call: () => editTask({ id: task.id, ...patch }),
      success: "Task saved.",
    });
  };

  return (
    <form className={styles.modalForm} autoComplete="off" onSubmit={submit} noValidate>
      <div className="mn-field">
        <label className="mn-label" htmlFor={`${uid}-t`}>
          Title
        </label>
        <input
          className="mn-input"
          id={`${uid}-t`}
          value={title}
          maxLength={300}
          autoFocus
          onChange={(e) => {
            setTitle(e.target.value);
            setTitleError(null);
          }}
          aria-invalid={titleError ? true : undefined}
          aria-describedby={titleError ? `${uid}-err` : undefined}
        />
        {titleError ? (
          <span id={`${uid}-err`}>
            <Message tone="error" as="span">
              {titleError}
            </Message>
          </span>
        ) : null}
      </div>
      <div className={styles.addRow}>
        <div className={cx("mn-field", styles.areaC)}>
          <label className="mn-label" htmlFor={`${uid}-c`}>
            Class
          </label>
          <select className="mn-select" id={`${uid}-c`} value={classId} onChange={(e) => setClassId(e.target.value)}>
            <ClassOptions classes={classes} />
          </select>
        </div>
        <div className={cx("mn-field", styles.areaD)}>
          <label className="mn-label" htmlFor={`${uid}-d`}>
            Due
          </label>
          <input
            className="mn-input mn-input--mono"
            id={`${uid}-d`}
            type="date"
            value={due}
            onChange={(e) => setDue(e.target.value)}
          />
        </div>
        <div className={cx("mn-field", styles.areaE)}>
          <label className="mn-label" htmlFor={`${uid}-e`}>
            Est.
          </label>
          <select className="mn-select" id={`${uid}-e`} value={est} onChange={(e) => setEst(e.target.value)}>
            {estOptions.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="mn-row">
        <Button type="submit" variant="primary">
          Save
        </Button>
        <button type="button" className={cx("mn-link", styles.closeLink)} onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  );
}
