CREATE TABLE "appointment_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_slug" text NOT NULL,
	"appointment_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"author_type" text NOT NULL,
	"author_id" text,
	"author_name" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolved_by" text,
	"history" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"edited_at" timestamp with time zone,
	"hidden_at" timestamp with time zone,
	"hidden_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "appointment_messages" ADD CONSTRAINT "appointment_messages_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "appointment_messages_appointment" ON "appointment_messages" USING btree ("appointment_id");