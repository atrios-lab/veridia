CREATE TABLE "ri_geometries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_slug" text NOT NULL,
	"property_id" uuid NOT NULL,
	"act_id" uuid,
	"source" text DEFAULT 'memorial' NOT NULL,
	"source_text" text DEFAULT '' NOT NULL,
	"vertices" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"zone" integer NOT NULL,
	"area_m2" double precision NOT NULL,
	"perimeter_m" double precision NOT NULL,
	"sigef_code" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"history" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" text
);
--> statement-breakpoint
ALTER TABLE "ri_geometries" ADD CONSTRAINT "ri_geometries_property_id_ri_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."ri_properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ri_geometries" ADD CONSTRAINT "ri_geometries_act_id_ri_acts_id_fk" FOREIGN KEY ("act_id") REFERENCES "public"."ri_acts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ri_geometries_property" ON "ri_geometries" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "ri_geometries_tenant" ON "ri_geometries" USING btree ("tenant_slug");