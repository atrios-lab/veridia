CREATE TABLE "signed_document_signatures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"tenant_slug" text NOT NULL,
	"certificate_id" uuid,
	"holder_name" text NOT NULL,
	"holder_document" text NOT NULL,
	"issuer_name" text NOT NULL,
	"serial_hex" text NOT NULL,
	"policy_oid" text NOT NULL,
	"result_sha256" text NOT NULL,
	"signed_by" text,
	"signed_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signed_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_slug" text NOT NULL,
	"code" text NOT NULL,
	"title" text NOT NULL,
	"original_name" text NOT NULL,
	"original_sha256" text NOT NULL,
	"page_count" integer NOT NULL,
	"file_path" text,
	"file_expires_at" timestamp with time zone NOT NULL,
	"file_purged_at" timestamp with time zone,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signing_certificate_signers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"certificate_id" uuid NOT NULL,
	"tenant_slug" text NOT NULL,
	"user_id" text NOT NULL,
	"granted_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "signing_certificates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_slug" text NOT NULL,
	"label" text NOT NULL,
	"holder_name" text NOT NULL,
	"holder_document" text NOT NULL,
	"kind" text NOT NULL,
	"issuer_name" text NOT NULL,
	"serial_hex" text NOT NULL,
	"fingerprint" text NOT NULL,
	"not_before" timestamp with time zone NOT NULL,
	"not_after" timestamp with time zone NOT NULL,
	"encrypted_pfx" text NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"disabled_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "signed_document_signatures" ADD CONSTRAINT "signed_document_signatures_document_id_signed_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."signed_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signed_document_signatures" ADD CONSTRAINT "signed_document_signatures_certificate_id_signing_certificates_id_fk" FOREIGN KEY ("certificate_id") REFERENCES "public"."signing_certificates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signing_certificate_signers" ADD CONSTRAINT "signing_certificate_signers_certificate_id_signing_certificates_id_fk" FOREIGN KEY ("certificate_id") REFERENCES "public"."signing_certificates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "signed_document_signatures_document" ON "signed_document_signatures" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "signed_document_signatures_result" ON "signed_document_signatures" USING btree ("result_sha256");--> statement-breakpoint
CREATE UNIQUE INDEX "signed_documents_code" ON "signed_documents" USING btree ("code");--> statement-breakpoint
CREATE INDEX "signed_documents_tenant_created" ON "signed_documents" USING btree ("tenant_slug","created_at");--> statement-breakpoint
CREATE INDEX "signing_certificate_signers_cert" ON "signing_certificate_signers" USING btree ("certificate_id");--> statement-breakpoint
CREATE UNIQUE INDEX "signing_certificate_signers_live" ON "signing_certificate_signers" USING btree ("certificate_id","user_id") WHERE "signing_certificate_signers"."revoked_at" is null;--> statement-breakpoint
CREATE INDEX "signing_certificates_tenant" ON "signing_certificates" USING btree ("tenant_slug");--> statement-breakpoint
CREATE UNIQUE INDEX "signing_certificates_tenant_fingerprint_live" ON "signing_certificates" USING btree ("tenant_slug","fingerprint") WHERE "signing_certificates"."disabled_at" is null;