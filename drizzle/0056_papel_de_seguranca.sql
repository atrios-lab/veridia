CREATE TABLE "security_paper_lots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_slug" text NOT NULL,
	"kind" text NOT NULL,
	"kind_label" text DEFAULT '' NOT NULL,
	"prefix" text DEFAULT '' NOT NULL,
	"first_number" bigint NOT NULL,
	"last_number" bigint NOT NULL,
	"digits" integer DEFAULT 6 NOT NULL,
	"received_on" text NOT NULL,
	"opening" boolean DEFAULT false NOT NULL,
	"supplier" text DEFAULT '' NOT NULL,
	"invoice" text DEFAULT '' NOT NULL,
	"requisition" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"invoice_path" text,
	"invoice_name" text,
	"created_by" text,
	"voided_at" timestamp with time zone,
	"voided_by" text,
	"void_reason" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "security_paper_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_slug" text NOT NULL,
	"lot_id" uuid NOT NULL,
	"type" text NOT NULL,
	"first_number" bigint NOT NULL,
	"last_number" bigint NOT NULL,
	"occurred_on" text NOT NULL,
	"reference" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_by" text,
	"voided_at" timestamp with time zone,
	"voided_by" text,
	"void_reason" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "security_paper_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_slug" text NOT NULL,
	"kind" text NOT NULL,
	"year" integer NOT NULL,
	"sequence" integer,
	"period_start" text NOT NULL,
	"period_end" text NOT NULL,
	"snapshot" jsonb NOT NULL,
	"movement_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"signer" integer DEFAULT 0 NOT NULL,
	"sent_on" text DEFAULT '' NOT NULL,
	"sent_reference" text DEFAULT '' NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "security_paper_movements" ADD CONSTRAINT "security_paper_movements_lot_id_security_paper_lots_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."security_paper_lots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "security_paper_lots_tenant" ON "security_paper_lots" USING btree ("tenant_slug","received_on");--> statement-breakpoint
CREATE INDEX "security_paper_movements_tenant" ON "security_paper_movements" USING btree ("tenant_slug","occurred_on");--> statement-breakpoint
CREATE INDEX "security_paper_movements_lot" ON "security_paper_movements" USING btree ("lot_id");--> statement-breakpoint
CREATE UNIQUE INDEX "security_paper_reports_tenant_year_sequence" ON "security_paper_reports" USING btree ("tenant_slug","year","sequence") WHERE "security_paper_reports"."sequence" is not null;--> statement-breakpoint
CREATE INDEX "security_paper_reports_tenant" ON "security_paper_reports" USING btree ("tenant_slug","period_end");