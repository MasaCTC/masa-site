ALTER TABLE "tasks" ADD COLUMN "on_today" boolean DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE "tasks" SET "on_today" = true WHERE "source" = 'manual';--> statement-breakpoint
DELETE FROM "tasks" WHERE "source" = 'canvas' AND "due_date" < (now() AT TIME ZONE 'America/Los_Angeles')::date AND "hand_edited" = false AND "done" = false AND NOT EXISTS (SELECT 1 FROM "status" s WHERE s."task_id" = "tasks"."id");
