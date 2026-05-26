ALTER TABLE "sections" ADD COLUMN IF NOT EXISTS "course_description" text;
ALTER TABLE "sections" ADD COLUMN IF NOT EXISTS "section_information_text" text;
ALTER TABLE "sections" ADD COLUMN IF NOT EXISTS "descriptions_fetched_at" timestamp with time zone;
