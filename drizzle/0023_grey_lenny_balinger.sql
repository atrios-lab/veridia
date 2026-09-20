CREATE TABLE "tutorials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"duration_seconds" integer NOT NULL,
	"video_path" text NOT NULL,
	"captions_path" text,
	"route" text,
	"trail" boolean DEFAULT true NOT NULL,
	"position" integer NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text
);
--> statement-breakpoint
-- Revisado a mao: o drizzle-kit gera o SET DATA TYPE sem USING, e o Postgres
-- nao converte text em uuid sozinho. A tabela esta vazia em todo ambiente
-- (criada na 0022 sem nenhum video no catalogo), entao nenhuma linha e
-- convertida; o USING fica para a conversao falhar alto, nunca em silencio,
-- se algum ambiente tiver uma linha que nao seja um uuid.
ALTER TABLE "tutorial_progress" ALTER COLUMN "video_id" SET DATA TYPE uuid USING "video_id"::uuid;--> statement-breakpoint
CREATE INDEX "tutorials_published_at" ON "tutorials" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "tutorials_position" ON "tutorials" USING btree ("position");--> statement-breakpoint
ALTER TABLE "tutorial_progress" ADD CONSTRAINT "tutorial_progress_video_id_tutorials_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."tutorials"("id") ON DELETE cascade ON UPDATE no action;