CREATE TABLE "cron_lease" (
	"key" text PRIMARY KEY NOT NULL,
	"acquired_at" timestamp with time zone DEFAULT now() NOT NULL
);
