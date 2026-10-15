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
-- Revisado a mao. Ate aqui video_id guardava o slug de uma entrada do
-- catalogo em codigo (src/core/tutorials/catalog.ts), que deixa de existir
-- nesta change: toda linha gravada ate agora aponta para um video que a
-- tabela "tutorials", recem-criada e vazia, nao tem, e a chave estrangeira
-- abaixo recusaria cada uma delas. Nenhuma foi gravada por serventia em
-- producao (nenhum video chegou a ser publicado); no Homolog ha marcas de
-- teste feitas com entradas temporarias. Limpar e o unico resultado
-- correto, e fica explicito aqui em vez de escondido num USING que falharia.
DELETE FROM "tutorial_progress";--> statement-breakpoint
-- O drizzle-kit gera o SET DATA TYPE sem USING, e o Postgres nao converte
-- text em uuid sozinho. Com a tabela vazia nada e convertido; o USING fica
-- para a conversao falhar alto se algum dia uma linha escapar do DELETE.
ALTER TABLE "tutorial_progress" ALTER COLUMN "video_id" SET DATA TYPE uuid USING "video_id"::uuid;--> statement-breakpoint
CREATE INDEX "tutorials_published_at" ON "tutorials" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "tutorials_position" ON "tutorials" USING btree ("position");--> statement-breakpoint
ALTER TABLE "tutorial_progress" ADD CONSTRAINT "tutorial_progress_video_id_tutorials_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."tutorials"("id") ON DELETE cascade ON UPDATE no action;