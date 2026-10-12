"use client";
// Planner client root: view tabs (deep-linked with ?view=), the optimistic
// stores, the action runner, the live region and the task modal.
import { useCallback, useMemo, useOptimistic, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Message } from "@/components/Feedback";
import { Tabs } from "@/components/Tabs";
import type { Class, Task } from "@/db/schema";
import type { Result } from "@/lib/planner/types";
import type { DueSoonRow, SettingsView as Settings, StatusView } from "@/lib/planner/queries";
import { errorCopy, type ActionFail, type ErrorCopy } from "../_lib/errors";
import { applyClassAction, applyTaskAction } from "../_lib/tasks";
import { PLANNER_VIEWS, type PlannerView } from "../_lib/views";
import styles from "../planner.module.css";
import { CalendarView } from "./CalendarView";
import { ClassesView } from "./ClassesView";
import { PlannerContext, type PlannerCtx, type RunOptions } from "./context";
import { SettingsView } from "./SettingsView";
import { TaskModal } from "./TaskModal";
import { TodayView } from "./TodayView";

export type PlannerProps = {
  today: string;
  tasks: Task[];
  classes: Class[];
  status: StatusView;
  dueSoon: DueSoonRow[];
  settings: Settings;
  initialView: PlannerView;
};

const LABELS: Record<PlannerView, string> = {
  today: "Today",
  calendar: "Calendar",
  classes: "Classes",
  settings: "Settings",
};

export function Planner(props: PlannerProps) {
  const router = useRouter();
  const [tasks, applyTask] = useOptimistic(props.tasks, applyTaskAction);
  const [classes, applyClass] = useOptimistic(props.classes, applyClassAction);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<ErrorCopy | null>(null);
  const [live, setLive] = useState("");
  const [view, setView] = useState<PlannerView>(props.initialView);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const flip = useRef(false);

  // Repeating the same sentence still gets read: alternate a trailing nbsp.
  const announce = useCallback((message: string) => {
    flip.current = !flip.current;
    setLive(message + (flip.current ? " " : ""));
  }, []);

  const run = useCallback(
    <T extends object>(opts: RunOptions<T>) => {
      setError(null);
      startTransition(async () => {
        opts.optimistic?.();
        let r: Result<T> | ActionFail;
        try {
          r = await opts.call();
        } catch {
          r = { ok: false, error: "network" };
        }
        if (r.ok) {
          opts.onOk?.(r);
          if (opts.success) announce(opts.success);
          return;
        }
        // Optimistic updates roll back on their own (useOptimistic drops them
        // when the transition ends). A missing row means our copy is old.
        if (r.error === "stale" || r.error === "not_found") router.refresh();
        if (opts.onFail?.(r) === true) return;
        // Only say "undone" when something was actually shown and rolled back.
        const copy = opts.optimistic ? errorCopy(r) : errorCopy(r, "");
        setError(copy);
        announce(copy.lead);
      });
    },
    [announce, router],
  );

  const selectView = (id: string) => {
    const next = id as PlannerView;
    setView(next);
    const url = new URL(window.location.href);
    if (next === "today") url.searchParams.delete("view");
    else url.searchParams.set("view", next);
    window.history.replaceState(window.history.state, "", url);
  };

  const classById = useMemo(() => new Map(classes.map((c) => [c.id, c])), [classes]);
  const ctx: PlannerCtx = {
    today: props.today,
    tasks,
    classes,
    classById,
    status: props.status,
    applyTask,
    applyClass,
    run,
    announce,
    openTask: setOpenTaskId,
    error,
  };

  const openTask = openTaskId ? tasks.find((t) => t.id === openTaskId) : undefined;

  return (
    <PlannerContext.Provider value={ctx}>
      <Tabs
        ariaLabel="Planner view"
        className={styles.tabs}
        selected={view}
        onSelect={selectView}
        tabs={PLANNER_VIEWS.map((id) => ({
          id,
          label: LABELS[id],
          domId: `planner-tab-${id}`,
          controls: id === view ? `planner-panel-${id}` : undefined,
        }))}
      />

      {error ? (
        <Message tone="error" detail={error.detail}>
          {error.lead}
        </Message>
      ) : null}

      {view === "today" ? (
        <TodayView panelId="planner-panel-today" tabId="planner-tab-today" dueSoon={props.dueSoon} />
      ) : view === "calendar" ? (
        <CalendarView panelId="planner-panel-calendar" tabId="planner-tab-calendar" />
      ) : view === "classes" ? (
        <ClassesView panelId="planner-panel-classes" tabId="planner-tab-classes" />
      ) : (
        <SettingsView panelId="planner-panel-settings" tabId="planner-tab-settings" settings={props.settings} />
      )}

      <p className={styles.srOnly} aria-live="polite">
        {live}
      </p>

      <TaskModal task={openTask} onClosed={() => setOpenTaskId(null)} />
    </PlannerContext.Provider>
  );
}
