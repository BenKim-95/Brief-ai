CREATE TABLE "email_subscribers" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"unsubscribe_token" text NOT NULL,
	"user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_subscribers_email_unique" UNIQUE("email"),
	CONSTRAINT "email_subscribers_unsubscribe_token_unique" UNIQUE("unsubscribe_token")
);
