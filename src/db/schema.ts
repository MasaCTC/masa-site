import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

// The 8 class colors from design/system (ClassColor.md, tokens.css --cls-*).
export const CLASS_COLORS = [
  "clay",
  "moss",
  "sea",
  "plum",
  "ochre",
  "slate",
  "rose",
  "teal",
] as const;
export type ClassColor = (typeof CLASS_COLORS)[number];

export const classKind = pgEnum("class_kind", ["class", "category"]);
export const classColor = pgEnum("class_color", CLASS_COLORS);
export const taskSource = pgEnum("task_source", ["manual", "canvas"]);
export const statusMode = pgEnum("status_mode", ["study", "build", "free"]);

export const classes = pgTable("classes", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  kind: classKind("kind").notNull().default("class"),
  color: classColor("color").notNull(),
  // Canvas course code (e.g. "CS 101"); used to match imported events.
  canvasCode: text("canvas_code").unique(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    classId: uuid("class_id").references(() => classes.id, {
      onDelete: "set null",
    }),
    dueDate: date("due_date", { mode: "string" }),
    estMinutes: integer("est_minutes"),
    done: boolean("done").notNull().default(false),
    doneAt: timestamp("done_at", { withTimezone: true }),
    // Lexicographic (fractional) rank: reordering updates a single row.
    // Always ORDER BY rank COLLATE "C" (byte order, not locale-dependent);
    // tasks_rank_idx below is built with that collation.
    rank: text("rank").notNull().$type<string>(),
    source: taskSource("source").notNull().default("manual"),
    canvasUid: text("canvas_uid").unique(),
    canvasUrl: text("canvas_url"),
    // Set when a Canvas task is edited/reordered/toggled by hand, so Canvas
    // sync never overwrites its title/rank/done.
    handEdited: boolean("hand_edited").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("tasks_rank_idx").using("btree", sql`${t.rank} COLLATE "C"`),
    index("tasks_class_id_idx").on(t.classId),
    index("tasks_due_date_idx").on(t.dueDate),
  ],
);

// Single-row table: id is pinned to 1 by a CHECK constraint.
export const status = pgTable(
  "status",
  {
    id: integer("id").primaryKey().default(1),
    mode: statusMode("mode").notNull().default("free"),
    classId: uuid("class_id").references(() => classes.id, {
      onDelete: "set null",
    }),
    text: text("text"),
    taskId: uuid("task_id").references(() => tasks.id, {
      onDelete: "set null",
    }),
    since: timestamp("since", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check("status_singleton", sql`${t.id} = 1`)],
);

// Single-row table: id is pinned to 1 by a CHECK constraint.
export const settings = pgTable(
  "settings",
  {
    id: integer("id").primaryKey().default(1),
    // AES-GCM ciphertext of the Canvas feed URL (never stored in plaintext).
    canvasFeedEnc: text("canvas_feed_enc"),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  },
  (t) => [check("settings_singleton", sql`${t.id} = 1`)],
);

export type Class = typeof classes.$inferSelect;
export type NewClass = typeof classes.$inferInsert;
export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
export type Status = typeof status.$inferSelect;
export type Settings = typeof settings.$inferSelect;
