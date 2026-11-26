CREATE TABLE IF NOT EXISTS "ri_protocols" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_slug" text NOT NULL,
	"kind" text DEFAULT 'prenotacao' NOT NULL,
	"number" integer NOT NULL,
	"presented_at" timestamp with time zone DEFAULT now() NOT NULL,
	"presented_on" date NOT NULL,
	"presenter_name" text NOT NULL,
	"presenter_document" text DEFAULT '' NOT NULL,
	"presenter_contact" text DEFAULT '' NOT NULL,
	"title_kind" text NOT NULL,
	"acts_summary" text DEFAULT '' NOT NULL,
	"property_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"fast" boolean DEFAULT false NOT NULL,
	"reurb" boolean DEFAULT false NOT NULL,
	"qualify_by" date,
	"prenotation_ends" date,
	"status" text DEFAULT 'prenotado' NOT NULL,
	"requirements" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"requirement_issued_at" timestamp with time zone,
	"requirement_issued_by" text,
	"reentry_on" date,
	"fees" text DEFAULT '' NOT NULL,
	"fee_cents" bigint,
	"notes" text DEFAULT '' NOT NULL,
	"reading" jsonb,
	"history" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"voided_at" timestamp with time zone,
	"voided_by" text
);
--> statement-breakpoint
ALTER TABLE "ri_files" ADD COLUMN IF NOT EXISTS "protocol_id" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ri_protocols_number" ON "ri_protocols" USING btree ("tenant_slug","kind","number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ri_protocols_status" ON "ri_protocols" USING btree ("tenant_slug","status");