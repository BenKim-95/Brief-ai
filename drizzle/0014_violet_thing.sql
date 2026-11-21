CREATE TABLE "site_visits" (
	"id" serial PRIMARY KEY NOT NULL,
	"day" date NOT NULL,
	"hour" smallint NOT NULL,
	"visitor_id" text NOT NULL,
	"path" text NOT NULL,
	"source" text DEFAULT 'web' NOT NULL
);
--> statement-breakpoint
CREATE INDEX "site_visits_day_idx" ON "site_visits" USING btree ("day");