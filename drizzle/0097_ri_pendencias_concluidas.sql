CREATE TABLE "ri_pendency_marks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_slug" text NOT NULL,
	"key" text NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"marked_by" text NOT NULL,
	"marked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"undone_at" timestamp with time zone,
	"undone_by" text
);
--> statement-breakpoint
CREATE INDEX "ri_pendency_marks_tenant" ON "ri_pendency_marks" USING btree ("tenant_slug","key");