CREATE TABLE "rcpn_imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_slug" text NOT NULL,
	"file_name" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"sha256" text NOT NULL,
	"stored_path" text,
	"format" text DEFAULT '' NOT NULL,
	"status" text NOT NULL,
	"notes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"records" jsonb,
	"published_count" integer,
	"uploaded_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	"closed_by" text
);
--> statement-breakpoint
CREATE TABLE "rcpn_people" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_slug" text NOT NULL,
	"record_id" uuid NOT NULL,
	"role" text NOT NULL,
	"name" text NOT NULL,
	"name_norm" text NOT NULL,
	"married_name" text DEFAULT '' NOT NULL,
	"mother_name" text DEFAULT '' NOT NULL,
	"mother_norm" text DEFAULT '' NOT NULL,
	"father_name" text DEFAULT '' NOT NULL,
	"birth_date" text DEFAULT '' NOT NULL,
	"profession" text DEFAULT '' NOT NULL,
	"father_profession" text DEFAULT '' NOT NULL,
	"mother_profession" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rcpn_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_slug" text NOT NULL,
	"kind" text NOT NULL,
	"subtype" text DEFAULT '' NOT NULL,
	"record_key" text NOT NULL,
	"matricula" text DEFAULT '' NOT NULL,
	"book" text DEFAULT '' NOT NULL,
	"page" text DEFAULT '' NOT NULL,
	"term" text DEFAULT '' NOT NULL,
	"registered_on" text DEFAULT '' NOT NULL,
	"event_on" text DEFAULT '' NOT NULL,
	"import_id" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "rcpn_people" ADD CONSTRAINT "rcpn_people_record_id_rcpn_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."rcpn_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rcpn_records" ADD CONSTRAINT "rcpn_records_import_id_rcpn_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."rcpn_imports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "rcpn_imports_tenant" ON "rcpn_imports" USING btree ("tenant_slug","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "rcpn_people_role" ON "rcpn_people" USING btree ("record_id","role");--> statement-breakpoint
CREATE INDEX "rcpn_people_lookup" ON "rcpn_people" USING btree ("tenant_slug","name_norm","birth_date");--> statement-breakpoint
CREATE INDEX "rcpn_people_birth" ON "rcpn_people" USING btree ("tenant_slug","birth_date");--> statement-breakpoint
CREATE UNIQUE INDEX "rcpn_records_key" ON "rcpn_records" USING btree ("tenant_slug","kind","record_key");