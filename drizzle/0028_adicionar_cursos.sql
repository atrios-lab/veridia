CREATE TABLE "courses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"poster_path" text,
	"material_path" text,
	"sequential" boolean DEFAULT false NOT NULL,
	"position" integer NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text
);
--> statement-breakpoint
-- Os vídeos que já existem são todos sobre o painel: viram o curso
-- "Uso do painel", publicado, de consulta. A coluna nasce anulável, é
-- preenchida e só então fica obrigatória.
INSERT INTO "courses" ("slug", "title", "description", "sequential", "position", "published_at")
VALUES ('uso-do-painel', 'Uso do painel', 'Cada tela do painel, do jeito que ela é usada no dia a dia.', false, 1, now());--> statement-breakpoint
ALTER TABLE "tutorials" ADD COLUMN "course_id" uuid;--> statement-breakpoint
UPDATE "tutorials" SET "course_id" = (SELECT "id" FROM "courses" WHERE "slug" = 'uso-do-painel');--> statement-breakpoint
ALTER TABLE "tutorials" ALTER COLUMN "course_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "tutorials" ADD COLUMN "kind" text DEFAULT 'lesson' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "courses_slug" ON "courses" USING btree ("slug");--> statement-breakpoint
ALTER TABLE "tutorials" ADD CONSTRAINT "tutorials_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tutorials_course" ON "tutorials" USING btree ("course_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tutorials_course_frame" ON "tutorials" USING btree ("course_id","kind") WHERE "tutorials"."kind" in ('intro', 'outro');