import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { articles, savedArticles } from "@/db/schema";
import { requireAdmin } from "@/lib/admin-auth";
import { parseId } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

/** Save an article (idempotent). `id` is the article id. */
export async function PUT(request: Request, { params }: Ctx) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const idResult = await parseId(params);
  if ("error" in idResult) return idResult.error;
  const db = getDb();
  const [article] = await db
    .select({ id: articles.id })
    .from(articles)
    .where(eq(articles.id, idResult.id));
  if (!article) return Response.json({ error: "찾을 수 없는 기사예요." }, { status: 404 });
  // Unique on (article_id, user_id) NULLS NOT DISTINCT: a second save is a no-op.
  await db
    .insert(savedArticles)
    .values({ articleId: idResult.id, userId: null })
    .onConflictDoNothing();
  return Response.json({ saved: true });
}

/** Un-save an article (idempotent). */
export async function DELETE(request: Request, { params }: Ctx) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const idResult = await parseId(params);
  if ("error" in idResult) return idResult.error;
  await getDb()
    .delete(savedArticles)
    .where(and(eq(savedArticles.articleId, idResult.id), isNull(savedArticles.userId)));
  return Response.json({ saved: false });
}
