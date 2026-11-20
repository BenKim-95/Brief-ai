CREATE TABLE "error_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"source" text NOT NULL,
	"message" text NOT NULL,
	"stack" text,
	"path" text,
	"user_agent" text,
	"count" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	CONSTRAINT "error_events_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE INDEX "error_events_last_seen_idx" ON "error_events" USING btree ("last_seen_at");