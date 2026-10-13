"use client";
// Running checklist (Checklist.md): ranked rows, drag the grip to reorder
// (dnd-kit, pointer only), or focus the grip and press Up / Down. Every move
// is saved with reorderTask between the new neighbours; the list updates
// optimistically and rolls back if the save fails.
import {
  closestCenter,
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import {
  Fragment,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { cx } from "@/components/types";
import type { Task } from "@/db/schema";
import { deleteTask, removeFromToday, reorderTask, setStatus, toggleDone } from "@/lib/planner/actions";
import { dueLabel, fmtMinutes } from "../_lib/dates";
import { isTemp, neighboursAfterMove } from "../_lib/tasks";
import styles from "../planner.module.css";
import { GripIcon, Swatch, XIcon } from "./bits";
import { ConfirmDialog } from "./ConfirmDialog";
import { usePlanner } from "./context";

const REDUCED = "(prefers-reduced-motion: reduce)";

export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(REDUCED);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(REDUCED).matches,
    () => false,
  );
}

/** Done checkbox; toggles optimistically. Also used by the class detail rows. */
export function CheckBox({ task }: { task: Task }) {
  const { run, applyTask } = usePlanner();
  return (
    <input
      type="checkbox"
      className="mn-box"
      aria-label={`Done: ${task.title}`}
      checked={task.done}
      disabled={isTemp(task.id)}
      onChange={(e) => {
        const done = e.target.checked;
        run({
          optimistic: () => applyTask({ type: "toggle", id: task.id, done, at: new Date() }),
          call: () => toggleDone({ id: task.id, done }),
        });
      }}
    />
  );
}

/** Task title; a button that opens the task modal (saved tasks only). */
export function TaskTitle({ task }: { task: Task }) {
  const { openTask } = usePlanner();
  return (
    <span className="mn-check__title">
      {isTemp(task.id) ? (
        task.title
      ) : (
        <button type="button" className={styles.titleBtn} data-task-opener={task.id} onClick={() => openTask(task.id)}>
          {task.title}
        </button>
      )}
    </span>
  );
}

type RowBodyProps = {
  task: Task;
  index: number;
  grip: ReactNode;
  onRemove: () => void;
};

/** Everything after the grip: shared by list rows and the drag overlay. */
function RowBody({ task, index, grip, onRemove }: RowBodyProps) {
  const { today, classById, status, run } = usePlanner();
  const cls = task.classId ? classById.get(task.classId) : undefined;
  const temp = isTemp(task.id);
  const dated = task.dueDate !== null;
  const onNow = status.mode === "build" && status.taskId === task.id;

  const meta: Array<[string, ReactNode]> = [];
  if (cls)
    meta.push([
      "class",
      <>
        <Swatch cls={cls} />
        {cls.name}
      </>,
    ]);
  if (task.dueDate) meta.push(["due", dueLabel(task.dueDate, today)]);
  if (task.source === "canvas") meta.push(["src", "Canvas"]);

  return (
    <>
      <span className="mn-check__rank">{index + 1}</span>
      {grip}
      <CheckBox task={task} />
      <div className="mn-check__body">
        <TaskTitle task={task} />
        <span className="mn-check__meta">
          {meta.map(([key, m], i) => (
            <Fragment key={key}>
              {i > 0 ? <span>·</span> : null}
              <span>{m}</span>
            </Fragment>
          ))}
          {onNow ? (
            <span>· on /now</span>
          ) : !task.done && !temp ? (
            <button
              type="button"
              className="mn-check__pub"
              onClick={() =>
                run({
                  call: () => setStatus({ taskId: task.id }),
                  success: `Status set to: Building ${task.title}`,
                })
              }
            >
              {meta.length ? "· " : ""}show on /now
            </button>
          ) : null}
        </span>
      </div>
      <span className="mn-check__est">{fmtMinutes(task.estMinutes)}</span>
      <button
        type="button"
        className="mn-check__x"
        aria-label={dated ? `Take ${task.title} off Today (stays on the calendar)` : `Delete ${task.title}`}
        title={dated ? "Take off Today" : "Delete"}
        disabled={temp}
        onClick={onRemove}
      >
        <XIcon />
      </button>
    </>
  );
}

type SortableRowProps = {
  task: Task;
  index: number;
  count: number;
  lifted: boolean;
  reduced: boolean;
  gripRef: (id: string, el: HTMLButtonElement | null) => void;
  onGripKeyDown: (e: KeyboardEvent<HTMLButtonElement>, task: Task, index: number) => void;
  onGripBlur: (task: Task) => void;
  onRemove: (task: Task) => void;
};

function SortableRow({ task, index, count, lifted, reduced, gripRef, onGripKeyDown, onGripBlur, onRemove }: SortableRowProps) {
  const temp = isTemp(task.id);
  const { setNodeRef, setActivatorNodeRef, listeners, transform, transition, isDragging } = useSortable({
    id: task.id,
    disabled: temp,
  });
  return (
    <li
      ref={setNodeRef}
      className={cx("mn-check", task.done && "is-done", lifted && "is-lifted", isDragging && "is-placeholder")}
      style={{
        transform: transform ? `translate3d(${Math.round(transform.x)}px, ${Math.round(transform.y)}px, 0)` : undefined,
        transition: reduced ? "none" : transition,
      }}
    >
      <RowBody
        task={task}
        index={index}
        onRemove={() => onRemove(task)}
        grip={
          <button
            type="button"
            ref={(el) => {
              setActivatorNodeRef(el);
              gripRef(task.id, el);
            }}
            className={cx("mn-grip", styles.grip)}
            aria-label={`Reorder ${task.title}. Position ${index + 1} of ${count}. Use up and down arrows.`}
            disabled={temp}
            {...listeners}
            onKeyDown={(e) => onGripKeyDown(e, task, index)}
            onBlur={() => onGripBlur(task)}
          >
            <GripIcon />
          </button>
        }
      />
    </li>
  );
}

export type ChecklistProps = {
  items: Task[];
  /** Where focus goes when the last row is removed (the add input). */
  fallbackFocus: RefObject<HTMLInputElement | null>;
};

export function Checklist({ items, fallbackFocus }: ChecklistProps) {
  const { run, applyTask, announce } = usePlanner();
  const reduced = useReducedMotion();
  const dndId = useId();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [liftedId, setLiftedId] = useState<string | null>(null);
  const grips = useRef(new Map<string, HTMLButtonElement>());
  // Set before a move/remove re-renders the list; the layout effect focuses it.
  const focusNext = useRef<string | "fallback" | null>(null);
  // The row whose x was pressed: asks first (ConfirmDialog), then removes.
  const [pending, setPending] = useState<Task | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const ids = items.map((t) => t.id);
  const count = items.length;

  useLayoutEffect(() => {
    const want = focusNext.current;
    if (!want) return;
    focusNext.current = null;
    const el = want === "fallback" ? null : grips.current.get(want);
    if (el && !el.disabled) el.focus();
    else fallbackFocus.current?.focus();
  });

  const gripRef = (id: string, el: HTMLButtonElement | null) => {
    if (el) grips.current.set(id, el);
    else grips.current.delete(id);
  };

  function move(task: Task, from: number, to: number, how: "drag" | "key") {
    if (to < 0 || to >= count || to === from) return;
    const { beforeId, afterId } = neighboursAfterMove(ids, from, to);
    if (beforeId === null && afterId === null) return;
    if (how === "key") announce(`${task.title} moved to position ${to + 1} of ${count}`);
    run({
      optimistic: () => applyTask({ type: "move", id: task.id, beforeId, afterId }),
      call: () => reorderTask({ id: task.id, beforeId, afterId }),
      success: how === "drag" ? "Order saved." : undefined,
    });
  }

  const onGripKeyDown = (e: KeyboardEvent<HTMLButtonElement>, task: Task, index: number) => {
    const dir = e.key === "ArrowUp" ? -1 : e.key === "ArrowDown" ? 1 : 0;
    if (!dir) return;
    e.preventDefault();
    const to = index + dir;
    if (to < 0 || to >= count) return;
    setLiftedId(task.id);
    focusNext.current = task.id;
    move(task, index, to, "key");
  };

  const onGripBlur = (task: Task) => {
    // A keyboard move re-inserts the row, which can blur its grip; the
    // layout effect puts focus back, so keep it lifted in that case.
    if (focusNext.current === task.id) return;
    setLiftedId((cur) => (cur === task.id ? null : cur));
  };

  const onRemove = (task: Task) => {
    if (task.dueDate === null) {
      setPending(task);
      return;
    }
    // Dated: stays on the calendar, so no confirm.
    const index = ids.indexOf(task.id);
    const neighbour = items[index + 1] ?? items[index - 1];
    focusNext.current = neighbour ? neighbour.id : "fallback";
    run({
      optimistic: () => applyTask({ type: "today-remove", id: task.id }),
      call: () => removeFromToday({ id: task.id }),
      success: "Taken off Today. Still on the calendar.",
    });
  };

  const remove = (task: Task) => {
    // Work out the neighbour now (the list may have changed while asking).
    const index = ids.indexOf(task.id);
    if (index === -1) return;
    const neighbour = items[index + 1] ?? items[index - 1];
    focusNext.current = neighbour ? neighbour.id : "fallback";
    run({
      optimistic: () => applyTask({ type: "delete", id: task.id }),
      call: () => deleteTask({ id: task.id }),
      success: `Removed ${task.title}.`,
    });
  };

  const onDragStart = ({ active }: DragStartEvent) => setActiveId(String(active.id));
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null);
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from === -1 || to === -1) return;
    move(items[from], from, to, "drag");
  };

  const titleOf = (id: string | number) => items.find((t) => t.id === id)?.title ?? "Task";
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${titleOf(active.id)}.`,
    onDragOver: () => undefined,
    onDragMove: () => undefined,
    onDragEnd: ({ active, over }) =>
      over ? `${titleOf(active.id)} moved to position ${ids.indexOf(String(over.id)) + 1} of ${count}` : undefined,
    onDragCancel: ({ active }) => `Reorder cancelled. ${titleOf(active.id)} is back in place.`,
  };

  const activeIndex = activeId ? ids.indexOf(activeId) : -1;
  const active = activeIndex >= 0 ? items[activeIndex] : null;

  return (
    <DndContext
      id={dndId}
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveId(null)}
      accessibility={{ announcements }}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ol className="mn-checklist" aria-label="Running checklist, most important first">
          {items.map((task, index) => (
            <SortableRow
              key={task.id}
              task={task}
              index={index}
              count={count}
              lifted={liftedId === task.id}
              reduced={reduced}
              gripRef={gripRef}
              onGripKeyDown={onGripKeyDown}
              onGripBlur={onGripBlur}
              onRemove={onRemove}
            />
          ))}
        </ol>
      </SortableContext>
      <DragOverlay dropAnimation={reduced ? null : undefined}>
        {active ? (
          <div className={cx("mn-check", "is-dragging", active.done && "is-done")} aria-hidden="true" inert>
            <RowBody
              task={active}
              index={activeIndex}
              onRemove={() => undefined}
              grip={
                <span className={cx("mn-grip", styles.grip)}>
                  <GripIcon />
                </span>
              }
            />
          </div>
        ) : null}
      </DragOverlay>
      <ConfirmDialog
        open={pending !== null}
        title={`Delete "${pending?.title ?? ""}"?`}
        sentence="It's removed from your list for good."
        onClosed={() => setPending(null)}
        onConfirm={() => {
          if (pending) remove(pending);
        }}
      />
    </DndContext>
  );
}
