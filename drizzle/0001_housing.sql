CREATE TABLE "housing_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"keywords" text[] DEFAULT '{}' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "housing_categories_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "housing_feeds" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"endpoint" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "housing_feeds_endpoint_unique" UNIQUE("endpoint")
);
--> statement-breakpoint
CREATE TABLE "housing_notices" (
	"id" serial PRIMARY KEY NOT NULL,
	"external_id" text NOT NULL,
	"feed_id" integer,
	"category_id" integer,
	"name" text NOT NULL,
	"type_label" text DEFAULT '' NOT NULL,
	"region" text,
	"address" text,
	"supply_count" integer,
	"announced_on" date,
	"receipt_start" date,
	"receipt_end" date,
	"winner_on" date,
	"detail_url" text,
	"raw" jsonb NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "housing_notices_external_id_unique" UNIQUE("external_id")
);
--> statement-breakpoint
ALTER TABLE "housing_notices" ADD CONSTRAINT "housing_notices_feed_id_housing_feeds_id_fk" FOREIGN KEY ("feed_id") REFERENCES "public"."housing_feeds"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "housing_notices" ADD CONSTRAINT "housing_notices_category_id_housing_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."housing_categories"("id") ON DELETE set null ON UPDATE no action;