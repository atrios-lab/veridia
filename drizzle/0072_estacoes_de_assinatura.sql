CREATE TABLE "signing_stations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_slug" text NOT NULL,
	"name" text NOT NULL,
	"key_hash" text NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone,
	"version" text,
	"certificates" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"revoked_at" timestamp with time zone,
	"revoked_by" text
);
--> statement-breakpoint
CREATE TABLE "station_certificate_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_slug" text NOT NULL,
	"station_id" uuid NOT NULL,
	"certificate_key" text NOT NULL,
	"shared" boolean DEFAULT false NOT NULL,
	"mode" text DEFAULT 'cada' NOT NULL,
	"signer_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"released_until" timestamp with time zone,
	"updated_by" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "station_sign_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_slug" text NOT NULL,
	"station_id" uuid NOT NULL,
	"certificate_key" text NOT NULL,
	"requested_by" text NOT NULL,
	"requested_by_name" text NOT NULL,
	"title" text NOT NULL,
	"to_be_signed" text NOT NULL,
	"mode" text NOT NULL,
	"status" text DEFAULT 'pendente' NOT NULL,
	"signature" text,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	"done_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "station_certificate_policies" ADD CONSTRAINT "station_certificate_policies_station_id_signing_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."signing_stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "station_sign_jobs" ADD CONSTRAINT "station_sign_jobs_station_id_signing_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."signing_stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "signing_stations_key" ON "signing_stations" USING btree ("key_hash");--> statement-breakpoint
CREATE INDEX "signing_stations_tenant" ON "signing_stations" USING btree ("tenant_slug");--> statement-breakpoint
CREATE UNIQUE INDEX "station_certificate_policies_cert" ON "station_certificate_policies" USING btree ("station_id","certificate_key");--> statement-breakpoint
CREATE INDEX "station_sign_jobs_station" ON "station_sign_jobs" USING btree ("station_id","status");--> statement-breakpoint
CREATE INDEX "station_sign_jobs_tenant" ON "station_sign_jobs" USING btree ("tenant_slug","created_at");