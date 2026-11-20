CREATE TABLE "article_views" (
	"article_id" integer NOT NULL,
	"visitor_id" text NOT NULL,
	"day" date NOT NULL,
	CONSTRAINT "article_views_article_id_visitor_id_day_pk" PRIMARY KEY("article_id","visitor_id","day")
);
--> statement-breakpoint
ALTER TABLE "article_views" ADD CONSTRAINT "article_views_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "article_views_day_idx" ON "article_views" USING btree ("day");