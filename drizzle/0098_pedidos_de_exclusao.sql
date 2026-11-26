CREATE TABLE "deletion_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_slug" text NOT NULL,
	"kind" text NOT NULL,
	"target_id" text NOT NULL,
	"label" text NOT NULL,
	"reason" text NOT NULL,
	"requested_by" text NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text DEFAULT 'pendente' NOT NULL,
	"decided_by" text,
	"decided_at" timestamp with time zone,
	"decision_note" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE INDEX "deletion_requests_tenant" ON "deletion_requests" USING btree ("tenant_slug","status");