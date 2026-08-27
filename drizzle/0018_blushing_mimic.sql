CREATE TABLE "email_bounces" (
	"email" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"detail" text DEFAULT '' NOT NULL,
	"permanent" boolean NOT NULL,
	"tenant_slug" text,
	"occurred_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
