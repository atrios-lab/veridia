CREATE TABLE "rcpn_certidoes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_slug" text NOT NULL,
	"kind" text NOT NULL,
	"subtype" text DEFAULT '' NOT NULL,
	"form" text DEFAULT 'breve' NOT NULL,
	"record_id" uuid,
	"fields" jsonb NOT NULL,
	"seal" text DEFAULT '' NOT NULL,
	"seal_kind" text DEFAULT '' NOT NULL,
	"fees" text DEFAULT '' NOT NULL,
	"signer_name" text DEFAULT '' NOT NULL,
	"signer_title" text DEFAULT '' NOT NULL,
	"attachment_path" text,
	"attachment_name" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text,
	"updated_at" timestamp with time zone,
	"removed_at" timestamp with time zone,
	"removed_by" text,
	"removed_reason" text
);
--> statement-breakpoint
ALTER TABLE "rcpn_certidoes" ADD CONSTRAINT "rcpn_certidoes_record_id_rcpn_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."rcpn_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "rcpn_certidoes_tenant" ON "rcpn_certidoes" USING btree ("tenant_slug","created_at");