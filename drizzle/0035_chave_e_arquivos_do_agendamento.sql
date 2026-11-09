CREATE TABLE "appointment_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_slug" text NOT NULL,
	"appointment_id" uuid NOT NULL,
	"stored_name" text NOT NULL,
	"display_name" text NOT NULL,
	"path" text,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "access_key_hash" text;--> statement-breakpoint
ALTER TABLE "appointment_attachments" ADD CONSTRAINT "appointment_attachments_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "appointment_attachments_appointment" ON "appointment_attachments" USING btree ("appointment_id");