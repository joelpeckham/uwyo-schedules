ALTER TABLE "planner_term_ui_state" ADD COLUMN "kept_solution_keys" jsonb DEFAULT '{"v":1,"keys":[]}'::jsonb NOT NULL;
ALTER TABLE "planner_term_ui_state" ADD COLUMN "time_prefs" jsonb DEFAULT '{"v":1}'::jsonb NOT NULL;
