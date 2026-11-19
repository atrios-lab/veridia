CREATE TABLE "messenger_reactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_slug" text NOT NULL,
	"message_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"emoji" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"removed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "messenger_messages" ADD COLUMN "reply_to_id" uuid;--> statement-breakpoint
ALTER TABLE "messenger_profiles" ADD COLUMN "typing_conversation_id" uuid;--> statement-breakpoint
ALTER TABLE "messenger_profiles" ADD COLUMN "typing_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "messenger_profiles" ADD COLUMN "message_sound" text;--> statement-breakpoint
ALTER TABLE "messenger_profiles" ADD COLUMN "nudge_sound" text;--> statement-breakpoint
ALTER TABLE "messenger_profiles" ADD COLUMN "sound_volume" integer DEFAULT 80 NOT NULL;--> statement-breakpoint
ALTER TABLE "messenger_profiles" ADD COLUMN "sound_in_chat" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "messenger_profiles" ADD COLUMN "sound_in_background" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "messenger_profiles" ADD COLUMN "repeat_until_read" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "messenger_profiles" ADD COLUMN "quiet_until" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "messenger_reactions_one" ON "messenger_reactions" USING btree ("message_id","user_id");--> statement-breakpoint
CREATE INDEX "messenger_reactions_updated" ON "messenger_reactions" USING btree ("updated_at");