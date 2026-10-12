"use client";
// Quick add (prototype #addForm): type a title and press Enter; "+ details"
// reveals class / due / estimate. The new task shows at the bottom at once
// (a temporary row, controls disabled) and is replaced by the saved row.
import { useId, useState, type RefObject } from "react";
import { Button } from "@/components/Button";
import { Message } from "@/components/Feedback";
import { cx } from "@/components/types";
import type { Task } from "@/db/schema";
import { addTask } from "@/lib/planner/actions";
import { fieldError } from "../_lib/errors";
import { TEMP_PREFIX } from "../_lib/tasks";
import styles from "../planner.module.css";
import { ClassOptions, EST_OPTIONS } from "./bits";
import { usePlanner } from "./context";

let tempSeq = 0;

export function AddForm({ inputRef }: { inputRef: RefObject<HTMLInputElement | null> }) {
  const { classes, run, applyTask } = usePlanner();
  const uid = useId();
  const [title, setTitle] = useState("");
  const [classId, setClassId] = useState("");
  const [due, setDue] = useState("");
  const [est, setEst] = useState("");
  const [more, setMore] = useState(false);
  const [titleError, setTitleError] = useState<string | null>(null);
  const moreId = `${uid}-more`;
  const errId = `${uid}-err`;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    const input = { title: t, classId: classId || null, dueDate: due || null, estMinutes: est ? Number(est) : null };
    const temp: Task = {
      id: `${TEMP_PREFIX}${++tempSeq}`,
      ...input,
      done: false,
      doneAt: null,
      rank: "",
      source: "manual",
      canvasUid: null,
      canvasUrl: null,
      handEdited: false,
      createdAt: new Date(),
    };
    setTitle("");
    setDue("");
    setEst("");
    setClassId("");
    setTitleError(null);
    run({
      optimistic: () => applyTask({ type: "add", task: temp }),
      call: () => addTask(input),
      success: "Added to the bottom of the list.",
      onFail: (r) => {
        // Give the text back so nothing typed is lost.
        setTitle((cur) => cur || t);
        const msg = fieldError(r, "title");
        if (msg) {
          setTitleError(msg);
          return true;
        }
      },
    });
  };

  return (
    <form className={styles.addForm} autoComplete="off" onSubmit={submit}>
      <div className={styles.addQuick}>
        <label className={styles.srOnly} htmlFor={`${uid}-t`}>
          Add a task
        </label>
        <input
          ref={inputRef}
          data-planner-add=""
          className="mn-input"
          id={`${uid}-t`}
          placeholder="Add a task… (just type and press Enter)"
          required
          maxLength={300}
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setTitleError(null);
          }}
          aria-invalid={titleError ? true : undefined}
          aria-describedby={titleError ? errId : undefined}
        />
        <Button type="submit" variant="primary">
          Add
        </Button>
      </div>
      {titleError ? (
        <span id={errId}>
          <Message tone="error" as="span">
            {titleError}
          </Message>
        </span>
      ) : null}
      <button
        type="button"
        className={cx("mn-link", styles.addMore)}
        aria-expanded={more}
        aria-controls={more ? moreId : undefined}
        onClick={() => setMore((m) => !m)}
      >
        {more ? "− hide details" : "+ details (optional)"}
      </button>
      {more ? (
        <div className={styles.addRow} id={moreId}>
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
              {EST_OPTIONS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : null}
    </form>
  );
}
