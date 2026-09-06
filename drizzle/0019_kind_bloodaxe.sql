CREATE TABLE "compliance_intakes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_slug" text NOT NULL,
	"answers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"section_updated_at" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"attachments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"submitted_at" timestamp with time zone,
	"submitted_version" integer DEFAULT 0 NOT NULL,
	"submitted_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text
);
--> statement-breakpoint
CREATE UNIQUE INDEX "compliance_intakes_tenant_slug_key" ON "compliance_intakes" USING btree ("tenant_slug");