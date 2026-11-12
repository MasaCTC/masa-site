import type { Class, Task } from "../../db/schema.ts";

export type TaskFilter = {
  day?: string;
  class?: string;
  status?: "open" | "done" | "all";
};

export type ClassRef = { ok: true; cls: Class } | { ok: false; message: string };

export type TaskView = {
  id: string;
  title: string;
  class: string | null;
  classKind: "class" | "category" | null;
  dueDate: string | null;
  estMinutes: number | null;
  done: boolean;
  doneAt: string | null;
  onToday: boolean;
  source: "manual" | "canvas";
  canvasUrl: string | null;
};

function available(classes: Class[]): string {
  return classes.length ? classes.map((c) => c.name).join(", ") : "(none)";
}

/** Resolve a class or category by exact id, else case-insensitive exact name. */
export function resolveClass(classes: Class[], ref: string): ClassRef {
  const byId = classes.find((c) => c.id === ref);
  if (byId) return { ok: true, cls: byId };
  const lower = ref.trim().toLowerCase();
  const matches = classes.filter((c) => c.name.toLowerCase() === lower);
  if (matches.length === 1) return { ok: true, cls: matches[0] };
  if (matches.length > 1) {
    const opts = matches.map((c) => `${c.name} (${c.kind}, id ${c.id})`).join("; ");
    return {
      ok: false,
      message: `"${ref}" is ambiguous; pass one of these ids instead: ${opts}`,
    };
  }
  return {
    ok: false,
    message: `No class or category matches "${ref}". Available: ${available(classes)}`,
  };
}

export function filterTasks(
  tasks: Task[],
  classes: Class[],
  f: TaskFilter,
): { ok: true; tasks: Task[] } | { ok: false; message: string } {
  let classId: string | undefined;
  if (f.class !== undefined) {
    const r = resolveClass(classes, f.class);
    if (!r.ok) return r;
    classId = r.cls.id;
  }
  const status = f.status ?? "open";
  return {
    ok: true,
    tasks: tasks.filter(
      (t) =>
        (status === "all" || (status === "done") === t.done) &&
        (f.day === undefined || t.dueDate === f.day) &&
        (classId === undefined || t.classId === classId),
    ),
  };
}

export function toTaskView(t: Task, classes: Class[]): TaskView {
  const c = t.classId ? classes.find((x) => x.id === t.classId) : undefined;
  return {
    id: t.id,
    title: t.title,
    class: c?.name ?? null,
    classKind: c?.kind ?? null,
    dueDate: t.dueDate,
    estMinutes: t.estMinutes,
    done: t.done,
    doneAt: t.doneAt ? t.doneAt.toISOString() : null,
    onToday: t.onToday,
    source: t.source,
    canvasUrl: t.canvasUrl,
  };
}
