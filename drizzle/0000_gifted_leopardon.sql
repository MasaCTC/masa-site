CREATE TYPE "public"."class_color" AS ENUM('clay', 'moss', 'sea', 'plum', 'ochre', 'slate', 'rose', 'teal');--> statement-breakpoint
CREATE TYPE "public"."class_kind" AS ENUM('class', 'category');--> statement-breakpoint
CREATE TYPE "public"."status_mode" AS ENUM('study', 'build', 'free');--> statement-breakpoint
CREATE TYPE "public"."task_source" AS ENUM('manual', 'canvas');--> statement-breakpoint
CREATE TABLE "classes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"kind" "class_kind" DEFAULT 'class' NOT NULL,
	"color" "class_color" NOT NULL,
	"canvas_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "classes_canvas_code_unique" UNIQUE("canvas_code")
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"canvas_feed_enc" text,
	"last_synced_at" timestamp with time zone,
	CONSTRAINT "settings_singleton" CHECK ("settings"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE "status" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"mode" "status_mode" DEFAULT 'free' NOT NULL,
	"class_id" uuid,
	"text" text,
	"task_id" uuid,
	"since" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "status_singleton" CHECK ("status"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"class_id" uuid,
	"due_date" date,
	"est_minutes" integer,
	"done" boolean DEFAULT false NOT NULL,
	"done_at" timestamp with time zone,
	"rank" text NOT NULL,
	"source" "task_source" DEFAULT 'manual' NOT NULL,
	"canvas_uid" text,
	"canvas_url" text,
	"hand_edited" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tasks_canvas_uid_unique" UNIQUE("canvas_uid")
);
--> statement-breakpoint
ALTER TABLE "status" ADD CONSTRAINT "status_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "status" ADD CONSTRAINT "status_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tasks_rank_idx" ON "tasks" USING btree ("rank" COLLATE "C");--> statement-breakpoint
CREATE INDEX "tasks_class_id_idx" ON "tasks" USING btree ("class_id");--> statement-breakpoint
CREATE INDEX "tasks_due_date_idx" ON "tasks" USING btree ("due_date");