DROP INDEX "service_requests_tenant_year_sequence";--> statement-breakpoint
ALTER TABLE "service_requests" ALTER COLUMN "act_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "service_requests" ALTER COLUMN "attribution" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "service_requests" ALTER COLUMN "applicant_name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "service_requests" ALTER COLUMN "contact" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "service_requests" ALTER COLUMN "access_key_hash" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "service_requests" ADD COLUMN "kind" text DEFAULT 'service-request' NOT NULL;--> statement-breakpoint
ALTER TABLE "service_requests" ADD COLUMN "details" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "service_requests" ADD COLUMN "office_reply" text;--> statement-breakpoint
ALTER TABLE "service_requests" ADD COLUMN "office_replied_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "service_requests_tenant_kind_year_sequence" ON "service_requests" USING btree ("tenant_slug","kind","protocol_year","protocol_sequence");