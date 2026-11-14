CREATE TABLE "rcpn_habilitacao_changes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_slug" text NOT NULL,
	"habilitacao_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"reason" text DEFAULT '' NOT NULL,
	"changes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"actor_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rcpn_habilitacoes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_slug" text NOT NULL,
	"year" integer NOT NULL,
	"sequence" integer NOT NULL,
	"fields" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"publication_id" uuid,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"canceled_at" timestamp with time zone,
	"canceled_by" text,
	"cancel_reason" text
);
--> statement-breakpoint
ALTER TABLE "rcpn_habilitacao_changes" ADD CONSTRAINT "rcpn_habilitacao_changes_habilitacao_id_rcpn_habilitacoes_id_fk" FOREIGN KEY ("habilitacao_id") REFERENCES "public"."rcpn_habilitacoes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "rcpn_habilitacao_changes_habilitacao" ON "rcpn_habilitacao_changes" USING btree ("habilitacao_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "rcpn_habilitacoes_tenant_year_sequence" ON "rcpn_habilitacoes" USING btree ("tenant_slug","year","sequence");--> statement-breakpoint
CREATE INDEX "rcpn_habilitacoes_tenant" ON "rcpn_habilitacoes" USING btree ("tenant_slug","created_at");