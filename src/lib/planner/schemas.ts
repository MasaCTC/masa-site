// Input validation for planner server actions. Pure (zod only; no
// server-only, no "@/" imports), so client forms may reuse these too.
import { z } from "zod";
import { CLASS_COLORS } from "../../db/class-colors.ts";

const blankToNull = (v: unknown) =>
  v === undefined || (typeof v === "string" && v.trim() === "") ? null : v;

const id = z.uuid();
const title = z.string().trim().min(1, "Title is required").max(300);
const className = z.string().trim().min(1, "Name is required").max(80);
const nullableId = z.preprocess(blankToNull, id.nullable());
const dueDate = z.preprocess(blankToNull, z.iso.date().nullable());
const estMinutes = z.preprocess(
  (v) => {
    const b = blankToNull(v);
    return typeof b === "string" ? Number(b) : b;
  },
  z.number().int().min(1).max(24 * 60).nullable(),
);

export const idSchema = z.object({ id });

export const addTaskSchema = z.object({
  title,
  classId: nullableId,
  dueDate,
  estMinutes,
});

export const editTaskSchema = z.object({
  id,
  title: title.optional(),
  classId: nullableId.optional(),
  dueDate: dueDate.optional(),
  estMinutes: estMinutes.optional(),
});

export const toggleDoneSchema = z.object({ id, done: z.boolean() });

// beforeId = the task directly above the new spot (more important),
// afterId = the task directly below it. null = list edge.
export const reorderTaskSchema = z
  .object({
    id,
    beforeId: id.nullable().default(null),
    afterId: id.nullable().default(null),
  })
  .refine((v) => v.beforeId !== null || v.afterId !== null, "No neighbours given")
  .refine((v) => v.beforeId !== v.id && v.afterId !== v.id, "A task can't be its own neighbour")
  .refine((v) => v.beforeId === null || v.beforeId !== v.afterId, "Neighbours must differ");

export const classColorSchema = z.enum(CLASS_COLORS);

export const createClassSchema = z.object({
  name: className,
  kind: z.enum(["class", "category"]),
  color: classColorSchema.optional(),
});

export const renameClassSchema = z.object({ id, name: className });
export const setClassColorSchema = z.object({ id, color: classColorSchema });

export const setStatusSchema = z.union([
  // "Show on /now" on a task: the server reads the title itself.
  z.object({ taskId: id }),
  z.discriminatedUnion("mode", [
    z.object({ mode: z.literal("study"), classId: id }),
    z.object({ mode: z.literal("build"), text: z.string().trim().min(1, "Say what you're building").max(120) }),
    z.object({ mode: z.literal("free") }),
  ]),
]);

const httpsUrl = z
  .string()
  .max(2048)
  .refine((s) => {
    try {
      const u = new URL(s);
      return u.protocol === "https:" && u.hostname !== "" && !u.username && !u.password;
    } catch {
      return false;
    }
  }, "Use the https:// feed link from Canvas");

// Empty string clears the saved feed.
export const canvasFeedSchema = z.object({
  url: z.preprocess(
    (v) => (typeof v === "string" ? blankToNull(v.trim()) ?? null : v),
    httpsUrl.nullable(),
  ),
});

/** Scheme + host and the last 4 characters only, e.g. https://canvas.x.edu/••••••••.ics */
export function maskFeedUrl(url: string): string {
  let origin = "";
  try {
    origin = new URL(url).origin;
  } catch {
    // Not a URL: show only the tail.
  }
  return `${origin}/••••••••${url.slice(-4)}`;
}

// Inputs accept form-ish values: "" means null, estMinutes may be a string.
type Optional = {
  classId?: string | null;
  dueDate?: string | null;
  estMinutes?: number | string | null;
};
export type AddTaskInput = { title: string } & Optional;
export type EditTaskInput = { id: string; title?: string } & Optional;
export type ToggleDoneInput = z.input<typeof toggleDoneSchema>;
export type ReorderTaskInput = z.input<typeof reorderTaskSchema>;
export type IdInput = z.input<typeof idSchema>;
export type CreateClassInput = z.input<typeof createClassSchema>;
export type RenameClassInput = z.input<typeof renameClassSchema>;
export type SetClassColorInput = z.input<typeof setClassColorSchema>;
export type SetStatusInput = z.input<typeof setStatusSchema>;
export type CanvasFeedInput = { url: string };
