import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { articles, savedArticles } from "@/db/schema";
import { parseId } from "@/lib/api";
import { ensureVisitorId, readVisitorId } from "@/lib/visitor";

type Ctx = { params: Promise<{ id: string }> };

/** 이 방문자의 저장함에 기사를 담는다(여러 번 눌러도 한 번만). `id`는 기사 id. 로그인·토큰 없이 쓴다. */
export async function PUT(_request: Request, { params }: Ctx) {
  const idResult = await parseId(params);
  if ("error" in idResult) return idResult.error;
  const db = getDb();
  const [article] = await db
    .select({ id: articles.id })
    .from(articles)
    .where(eq(articles.id, idResult.id));
  if (!article) return Response.json({ error: "찾을 수 없는 기사예요." }, { status: 404 });
  const visitorId = await ensureVisitorId();
  // (article_id, user_id)가 유일해서 두 번째 저장은 아무 일도 하지 않는다.
  await db
    .insert(savedArticles)
    .values({ articleId: idResult.id, userId: visitorId })
    .onConflictDoNothing();
  return Response.json({ saved: true });
}

/** 이 방문자의 저장함에서 기사를 뺀다(없어도 성공). */
export async function DELETE(_request: Request, { params }: Ctx) {
  const idResult = await parseId(params);
  if ("error" in idResult) return idResult.error;
  const visitorId = await readVisitorId();
  if (visitorId) {
    await getDb()
      .delete(savedArticles)
      .where(and(eq(savedArticles.articleId, idResult.id), eq(savedArticles.userId, visitorId)));
  }
  return Response.json({ saved: false });
}
