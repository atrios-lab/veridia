CREATE TABLE "demo_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_slug" text NOT NULL,
	"to" text NOT NULL,
	"subject" text NOT NULL,
	"text" text NOT NULL,
	"related_kind" text,
	"related_protocol" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "demo_outbox_tenant_created_at" ON "demo_outbox" USING btree ("tenant_slug","created_at");--> statement-breakpoint
CREATE INDEX "demo_outbox_related" ON "demo_outbox" USING btree ("tenant_slug","related_kind","related_protocol");