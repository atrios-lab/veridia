CREATE TABLE "ri_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_slug" text NOT NULL,
	"property_id" uuid,
	"act_id" uuid,
	"kind" text DEFAULT 'documento' NOT NULL,
	"name" text NOT NULL,
	"mime" text DEFAULT 'application/octet-stream' NOT NULL,
	"size" integer DEFAULT 0 NOT NULL,
	"path" text NOT NULL,
	"reading" jsonb,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" text
);
--> statement-breakpoint
ALTER TABLE "ri_properties" ADD COLUMN "aux_kind" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "ri_properties" ADD COLUMN "linked_numbers" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "ri_settings" ADD COLUMN "signer_index" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "ri_settings" ADD COLUMN "signature_image" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "ri_settings" ADD COLUMN "signature_updated_by" text;--> statement-breakpoint
ALTER TABLE "ri_settings" ADD COLUMN "signature_updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "ri_files" ADD CONSTRAINT "ri_files_property_id_ri_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."ri_properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ri_files" ADD CONSTRAINT "ri_files_act_id_ri_acts_id_fk" FOREIGN KEY ("act_id") REFERENCES "public"."ri_acts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ri_files_property" ON "ri_files" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "ri_files_tenant" ON "ri_files" USING btree ("tenant_slug");