CREATE TABLE "rcpn_record_changes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_slug" text NOT NULL,
	"record_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"reason" text NOT NULL,
	"changes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"actor_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "rcpn_records" ADD COLUMN "edited_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "rcpn_records" ADD COLUMN "edited_by" text;--> statement-breakpoint
ALTER TABLE "rcpn_records" ADD COLUMN "canceled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "rcpn_records" ADD COLUMN "canceled_by" text;--> statement-breakpoint
ALTER TABLE "rcpn_records" ADD COLUMN "cancel_reason" text;--> statement-breakpoint
ALTER TABLE "rcpn_record_changes" ADD CONSTRAINT "rcpn_record_changes_record_id_rcpn_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."rcpn_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "rcpn_record_changes_record" ON "rcpn_record_changes" USING btree ("record_id","created_at");