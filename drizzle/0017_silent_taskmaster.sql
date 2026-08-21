ALTER TABLE "appointments" ADD COLUMN "origin" text DEFAULT 'site' NOT NULL;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "protocol_year" integer;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "protocol_sequence" integer;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "protocol_number" text;--> statement-breakpoint
CREATE UNIQUE INDEX "appointments_tenant_year_sequence" ON "appointments" USING btree ("tenant_slug","protocol_year","protocol_sequence");--> statement-breakpoint
CREATE UNIQUE INDEX "appointments_tenant_protocol" ON "appointments" USING btree ("tenant_slug","protocol_number");