CREATE TABLE "saved_housing_notices" (
	"id" serial PRIMARY KEY NOT NULL,
	"notice_id" integer NOT NULL,
	"user_id" text,
	"note" text,
	"saved_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "saved_housing_notices_notice_user_uq" UNIQUE NULLS NOT DISTINCT("notice_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "saved_housing_notices" ADD CONSTRAINT "saved_housing_notices_notice_id_housing_notices_id_fk" FOREIGN KEY ("notice_id") REFERENCES "public"."housing_notices"("id") ON DELETE cascade ON UPDATE no action;