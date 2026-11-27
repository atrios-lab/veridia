CREATE TABLE "ri_foreign_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_slug" text NOT NULL,
	"number" integer NOT NULL,
	"kind" text DEFAULT 'aquisicao' NOT NULL,
	"registered_on" date NOT NULL,
	"matricula" integer,
	"act_ref" text DEFAULT '' NOT NULL,
	"acquirer_kind" text DEFAULT 'pf-estrangeira' NOT NULL,
	"acquirer_name" text NOT NULL,
	"nationality" text DEFAULT '' NOT NULL,
	"acquirer_document" text DEFAULT '' NOT NULL,
	"spouse_name" text DEFAULT '' NOT NULL,
	"spouse_cpf" text DEFAULT '' NOT NULL,
	"transmitter_name" text DEFAULT '' NOT NULL,
	"transmitter_document" text DEFAULT '' NOT NULL,
	"area" text DEFAULT '' NOT NULL,
	"municipality" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"ccir" text DEFAULT '' NOT NULL,
	"security_area" boolean DEFAULT false NOT NULL,
	"authority_body" text DEFAULT '' NOT NULL,
	"authorization_number" text DEFAULT '' NOT NULL,
	"authorization_date" date,
	"notes" text DEFAULT '' NOT NULL,
	"averbacoes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"history" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE "ri_foreign_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_slug" text NOT NULL,
	"year" integer NOT NULL,
	"quarter" integer NOT NULL,
	"kind" text NOT NULL,
	"recipients" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sent_on" date NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"history" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" text
);
--> statement-breakpoint
CREATE INDEX "ri_foreign_entries_tenant" ON "ri_foreign_entries" USING btree ("tenant_slug","number");--> statement-breakpoint
CREATE INDEX "ri_foreign_reports_tenant" ON "ri_foreign_reports" USING btree ("tenant_slug","year");