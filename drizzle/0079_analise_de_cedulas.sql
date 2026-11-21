CREATE TABLE "cedula_analyses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_slug" text NOT NULL,
	"request_id" uuid,
	"kind" text NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"data" jsonb NOT NULL,
	"models" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"history" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"files" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"source" text NOT NULL,
	"ai_note" text,
	"detected_kind" text,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text,
	"updated_at" timestamp with time zone,
	"removed_at" timestamp with time zone,
	"removed_by" text,
	"removed_reason" text
);
--> statement-breakpoint
CREATE TABLE "cedula_learned_cues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_slug" text NOT NULL,
	"cue" text NOT NULL,
	"kind" text NOT NULL,
	"uses" integer DEFAULT 1 NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"removed_at" timestamp with time zone,
	"removed_by" text
);
--> statement-breakpoint
ALTER TABLE "cedula_analyses" ADD CONSTRAINT "cedula_analyses_request_id_service_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."service_requests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cedula_analyses_tenant" ON "cedula_analyses" USING btree ("tenant_slug","created_at");--> statement-breakpoint
CREATE INDEX "cedula_analyses_request" ON "cedula_analyses" USING btree ("request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "cedula_learned_cues_cue" ON "cedula_learned_cues" USING btree ("tenant_slug","cue");