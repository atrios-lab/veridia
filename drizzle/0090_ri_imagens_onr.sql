CREATE TABLE "ri_onr_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_slug" text NOT NULL,
	"number" integer NOT NULL,
	"property_id" uuid,
	"source_name" text DEFAULT '' NOT NULL,
	"source" text DEFAULT 'pdf' NOT NULL,
	"pattern" text DEFAULT 'p12' NOT NULL,
	"pages" integer DEFAULT 1 NOT NULL,
	"tiff" text NOT NULL,
	"signed" boolean DEFAULT false NOT NULL,
	"issues" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"copied_at" timestamp with time zone,
	"copied_by" text,
	"history" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" text
);
--> statement-breakpoint
ALTER TABLE "ri_onr_images" ADD CONSTRAINT "ri_onr_images_property_id_ri_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."ri_properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ri_onr_images_tenant" ON "ri_onr_images" USING btree ("tenant_slug","number");