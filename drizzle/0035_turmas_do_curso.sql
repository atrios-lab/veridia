CREATE TABLE "cohort_members" (
	"user_id" text PRIMARY KEY NOT NULL,
	"cohort_id" uuid NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"contact_consent_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "course_cohorts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"course_id" uuid NOT NULL,
	"office_name" text NOT NULL,
	"office_city" text NOT NULL,
	"contact_name" text NOT NULL,
	"contact_phone" text NOT NULL,
	"seats" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text
);
--> statement-breakpoint
ALTER TABLE "cohort_members" ADD CONSTRAINT "cohort_members_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cohort_members" ADD CONSTRAINT "cohort_members_cohort_id_course_cohorts_id_fk" FOREIGN KEY ("cohort_id") REFERENCES "public"."course_cohorts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_cohorts" ADD CONSTRAINT "course_cohorts_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cohort_members_cohort" ON "cohort_members" USING btree ("cohort_id");--> statement-breakpoint
CREATE UNIQUE INDEX "course_cohorts_code" ON "course_cohorts" USING btree ("code");