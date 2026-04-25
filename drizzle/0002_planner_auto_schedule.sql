ALTER TABLE "planner_items" ADD COLUMN "instructor_prefs" jsonb DEFAULT '{"v":1,"primary":[]}'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "planner_items" ALTER COLUMN "anchor_crn" DROP NOT NULL;
--> statement-breakpoint
CREATE TABLE "planner_term_ui_state" (
	"session_id" uuid NOT NULL,
	"term_code" text NOT NULL,
	"last_solution_index" integer DEFAULT 0 NOT NULL,
	"favorite_solution_index" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "planner_term_ui_state_session_id_term_code_pk" PRIMARY KEY("session_id","term_code")
);
--> statement-breakpoint
ALTER TABLE "planner_term_ui_state" ADD CONSTRAINT "planner_term_ui_state_session_id_planner_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."planner_sessions"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "planner_term_ui_state" ADD CONSTRAINT "planner_term_ui_state_term_code_terms_code_fk" FOREIGN KEY ("term_code") REFERENCES "public"."terms"("code") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "planner_items" ADD CONSTRAINT "planner_items_selection_integrity" CHECK (
	(
		"selection_kind" = 'unresolved'
		AND "anchor_crn" IS NULL
		AND "linked_bundle_id" IS NULL
	)
	OR (
		"selection_kind" = 'single_crn'
		AND "anchor_crn" IS NOT NULL
		AND "linked_bundle_id" IS NULL
	)
	OR (
		"selection_kind" = 'linked_bundle'
		AND "anchor_crn" IS NOT NULL
		AND "linked_bundle_id" IS NOT NULL
	)
);
