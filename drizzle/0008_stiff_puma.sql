CREATE TABLE "visitor_profiles" (
	"visitor_id" text PRIMARY KEY NOT NULL,
	"nickname" text DEFAULT '' NOT NULL,
	"interest_category_ids" integer[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
