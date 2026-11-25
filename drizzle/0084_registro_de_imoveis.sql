CREATE TABLE "ri_act_parties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_slug" text NOT NULL,
	"act_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"role" text NOT NULL,
	"share" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"removed_at" timestamp with time zone,
	"removed_by" text
);
--> statement-breakpoint
CREATE TABLE "ri_acts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_slug" text NOT NULL,
	"property_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"seq" integer NOT NULL,
	"effect" text NOT NULL,
	"nature" text DEFAULT '' NOT NULL,
	"registered_on" date,
	"summary" text DEFAULT '' NOT NULL,
	"cancels_act_id" uuid,
	"protocol" text DEFAULT '' NOT NULL,
	"seal" text DEFAULT '' NOT NULL,
	"value_cents" bigint,
	"history" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE "ri_exports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_slug" text NOT NULL,
	"kind" text NOT NULL,
	"mode" text DEFAULT '' NOT NULL,
	"file_name" text NOT NULL,
	"content" text NOT NULL,
	"record_count" integer DEFAULT 0 NOT NULL,
	"skipped" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sha256" text NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"imported_at" timestamp with time zone,
	"imported_by" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"withdrawn_at" timestamp with time zone,
	"withdrawn_by" text
);
--> statement-breakpoint
CREATE TABLE "ri_people" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_slug" text NOT NULL,
	"name" text NOT NULL,
	"document" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"history" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE "ri_properties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_slug" text NOT NULL,
	"book" integer DEFAULT 2 NOT NULL,
	"number" integer NOT NULL,
	"record_kind" integer DEFAULT 1 NOT NULL,
	"status" integer DEFAULT 0 NOT NULL,
	"cnm" text DEFAULT '' NOT NULL,
	"cnm_in_pgv" boolean DEFAULT false NOT NULL,
	"opened_on" date,
	"origin" text DEFAULT '' NOT NULL,
	"ficha" text DEFAULT '' NOT NULL,
	"location" integer DEFAULT 0 NOT NULL,
	"property_kind" integer,
	"street_kind" integer,
	"street" text DEFAULT '' NOT NULL,
	"street_number" text DEFAULT '' NOT NULL,
	"district" text DEFAULT '' NOT NULL,
	"cep" text DEFAULT '' NOT NULL,
	"complement" text DEFAULT '' NOT NULL,
	"quadra" text DEFAULT '' NOT NULL,
	"setor" text DEFAULT '' NOT NULL,
	"conjunto" text DEFAULT '' NOT NULL,
	"lote" text DEFAULT '' NOT NULL,
	"loteamento" text DEFAULT '' NOT NULL,
	"contributors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"rural" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"condo" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"area" text DEFAULT '' NOT NULL,
	"prior_acts" integer DEFAULT 0 NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"history" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE "ri_settings" (
	"tenant_slug" text PRIMARY KEY NOT NULL,
	"ibge_city" text DEFAULT '' NOT NULL,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ri_act_parties" ADD CONSTRAINT "ri_act_parties_act_id_ri_acts_id_fk" FOREIGN KEY ("act_id") REFERENCES "public"."ri_acts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ri_act_parties" ADD CONSTRAINT "ri_act_parties_person_id_ri_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."ri_people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ri_acts" ADD CONSTRAINT "ri_acts_property_id_ri_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."ri_properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ri_act_parties_act" ON "ri_act_parties" USING btree ("act_id");--> statement-breakpoint
CREATE INDEX "ri_act_parties_person" ON "ri_act_parties" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "ri_acts_property" ON "ri_acts" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "ri_exports_kind" ON "ri_exports" USING btree ("tenant_slug","kind");--> statement-breakpoint
CREATE INDEX "ri_people_document" ON "ri_people" USING btree ("tenant_slug","document");--> statement-breakpoint
CREATE INDEX "ri_properties_number" ON "ri_properties" USING btree ("tenant_slug","book","number");