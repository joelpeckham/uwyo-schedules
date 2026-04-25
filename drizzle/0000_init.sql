CREATE TABLE "courses" (
	"term_code" text NOT NULL,
	"subject" text NOT NULL,
	"course_number" text NOT NULL,
	"subject_course" text,
	CONSTRAINT "courses_term_code_subject_course_number_pk" PRIMARY KEY("term_code","subject","course_number")
);
--> statement-breakpoint
CREATE TABLE "linked_bundle_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"bundle_id" integer NOT NULL,
	"crn" text NOT NULL,
	"position" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "linked_bundles" (
	"id" serial PRIMARY KEY NOT NULL,
	"term_code" text NOT NULL,
	"anchor_crn" text NOT NULL,
	"bundle_index" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "section_attributes" (
	"id" serial PRIMARY KEY NOT NULL,
	"term_code" text NOT NULL,
	"section_crn" text NOT NULL,
	"code" text NOT NULL,
	"description" text,
	"is_ztc_attribute" boolean,
	"attr_raw_json" jsonb
);
--> statement-breakpoint
CREATE TABLE "section_faculty" (
	"id" serial PRIMARY KEY NOT NULL,
	"term_code" text NOT NULL,
	"section_crn" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"banner_id" text,
	"display_name" text,
	"email_address" text,
	"primary_indicator" boolean,
	"faculty_raw_json" jsonb
);
--> statement-breakpoint
CREATE TABLE "section_meetings" (
	"id" serial PRIMARY KEY NOT NULL,
	"term_code" text NOT NULL,
	"section_crn" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"begin_time" text,
	"end_time" text,
	"monday" boolean,
	"tuesday" boolean,
	"wednesday" boolean,
	"thursday" boolean,
	"friday" boolean,
	"saturday" boolean,
	"sunday" boolean,
	"building" text,
	"building_description" text,
	"room" text,
	"campus" text,
	"campus_description" text,
	"start_date" text,
	"end_date" text,
	"meeting_schedule_type" text,
	"meeting_type" text,
	"meeting_type_description" text,
	"hours_week" real,
	"credit_hour_session" real,
	"category" text,
	"meeting_raw_json" jsonb
);
--> statement-breakpoint
CREATE TABLE "sections" (
	"term_code" text NOT NULL,
	"crn" text NOT NULL,
	"subject" text NOT NULL,
	"course_number" text NOT NULL,
	"sequence_number" text,
	"subject_description" text,
	"course_title" text,
	"subject_course" text,
	"schedule_type_description" text,
	"part_of_term" text,
	"campus_description" text,
	"instructional_method" text,
	"instructional_method_description" text,
	"credit_hours" real,
	"credit_hour_high" real,
	"credit_hour_low" real,
	"credit_hour_indicator" text,
	"enrollment" integer,
	"maximum_enrollment" integer,
	"seats_available" integer,
	"wait_capacity" integer,
	"wait_count" integer,
	"wait_available" integer,
	"open_section" boolean,
	"cross_list" text,
	"cross_list_capacity" integer,
	"cross_list_count" integer,
	"cross_list_available" integer,
	"link_identifier" text,
	"is_section_linked" boolean,
	"banner_row_id" integer,
	"raw_json" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sections_term_code_crn_pk" PRIMARY KEY("term_code","crn")
);
--> statement-breakpoint
CREATE TABLE "terms" (
	"code" text PRIMARY KEY NOT NULL,
	"description" text NOT NULL,
	"last_full_scrape_at" timestamp with time zone,
	"last_hot_scrape_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_term_code_terms_code_fk" FOREIGN KEY ("term_code") REFERENCES "public"."terms"("code") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "linked_bundle_members" ADD CONSTRAINT "linked_bundle_members_bundle_id_linked_bundles_id_fk" FOREIGN KEY ("bundle_id") REFERENCES "public"."linked_bundles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sections" ADD CONSTRAINT "sections_term_code_terms_code_fk" FOREIGN KEY ("term_code") REFERENCES "public"."terms"("code") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "courses_term_idx" ON "courses" USING btree ("term_code");--> statement-breakpoint
CREATE UNIQUE INDEX "linked_bundle_members_unique" ON "linked_bundle_members" USING btree ("bundle_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "linked_bundle_members_crn_unique" ON "linked_bundle_members" USING btree ("bundle_id","crn");--> statement-breakpoint
CREATE UNIQUE INDEX "linked_bundles_natural" ON "linked_bundles" USING btree ("term_code","anchor_crn","bundle_index");--> statement-breakpoint
CREATE INDEX "linked_bundles_term_anchor_idx" ON "linked_bundles" USING btree ("term_code","anchor_crn");--> statement-breakpoint
CREATE UNIQUE INDEX "section_attributes_unique" ON "section_attributes" USING btree ("term_code","section_crn","code");--> statement-breakpoint
CREATE INDEX "section_faculty_section_idx" ON "section_faculty" USING btree ("term_code","section_crn");--> statement-breakpoint
CREATE INDEX "section_meetings_section_idx" ON "section_meetings" USING btree ("term_code","section_crn");--> statement-breakpoint
CREATE INDEX "sections_term_subject_idx" ON "sections" USING btree ("term_code","subject");--> statement-breakpoint
CREATE INDEX "sections_term_linked_idx" ON "sections" USING btree ("term_code","is_section_linked");--> statement-breakpoint
CREATE INDEX "sections_term_link_id_idx" ON "sections" USING btree ("term_code","link_identifier");