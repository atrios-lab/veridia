CREATE TABLE "tax_guides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_slug" text NOT NULL,
	"kind" text NOT NULL,
	"year" integer NOT NULL,
	"sequence" integer NOT NULL,
	"payload" jsonb NOT NULL,
	"service_request_id" uuid,
	"created_by" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tax_guides" ADD CONSTRAINT "tax_guides_service_request_id_service_requests_id_fk" FOREIGN KEY ("service_request_id") REFERENCES "public"."service_requests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "tax_guides_tenant_year_sequence_live" ON "tax_guides" USING btree ("tenant_slug","year","sequence") WHERE "tax_guides"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "tax_guides_tenant_created" ON "tax_guides" USING btree ("tenant_slug","created_at");