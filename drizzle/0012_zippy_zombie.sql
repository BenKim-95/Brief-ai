CREATE TABLE "community_comments" (
	"id" serial PRIMARY KEY NOT NULL,
	"post_id" integer NOT NULL,
	"visitor_id" text NOT NULL,
	"author_name" text NOT NULL,
	"body" text NOT NULL,
	"hidden" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "community_posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"visitor_id" text NOT NULL,
	"author_name" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"article_id" integer,
	"hidden" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "community_reports" (
	"kind" text NOT NULL,
	"target_id" integer NOT NULL,
	"visitor_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "community_reports_kind_target_id_visitor_id_pk" PRIMARY KEY("kind","target_id","visitor_id")
);
--> statement-breakpoint
ALTER TABLE "community_comments" ADD CONSTRAINT "community_comments_post_id_community_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."community_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_posts" ADD CONSTRAINT "community_posts_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "community_comments_post_idx" ON "community_comments" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "community_comments_visitor_idx" ON "community_comments" USING btree ("visitor_id");--> statement-breakpoint
CREATE INDEX "community_posts_created_idx" ON "community_posts" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "community_posts_visitor_idx" ON "community_posts" USING btree ("visitor_id");