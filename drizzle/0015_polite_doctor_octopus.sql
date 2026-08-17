CREATE TABLE "appointments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_slug" text NOT NULL,
	"date" date NOT NULL,
	"slot_time" text NOT NULL,
	"citizen_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"cpf" text,
	"service_id" text NOT NULL,
	"service_label" text NOT NULL,
	"mode" text NOT NULL,
	"status" text DEFAULT 'booked' NOT NULL,
	"cancel_reason" text,
	"cancelled_at" timestamp with time zone,
	"cancel_token_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "appointments_tenant_date_slot_live" ON "appointments" USING btree ("tenant_slug","date","slot_time") WHERE "appointments"."status" = 'booked';--> statement-breakpoint
CREATE INDEX "appointments_tenant_date" ON "appointments" USING btree ("tenant_slug","date");--> statement-breakpoint
CREATE INDEX "appointments_cancel_token" ON "appointments" USING btree ("cancel_token_hash");