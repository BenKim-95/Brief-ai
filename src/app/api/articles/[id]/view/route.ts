import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { articles } from "@/db/schema";
import { parseId } from "@/lib/api";
import { recordView } from "@/lib/news/five-minute";
import { ensureVisitorId } from "@/lib/visitor";

type Ctx = { params: Promise<{ id: string }> };

/** 기사 조회 1회를 기록한다(방문자·기사·날짜당 1건, 5분 이슈 순위용). 로그인·토큰 없이 쓴다. */
export async function POST(_request: Request, { params }: Ctx) {
  const idResult = await parseId(params);
  if ("error" in idResult) return idResult.error;
  const db = getDb();
  const [article] = await db.select({ id: articles.id }).from(articles).where(eq(articles.id, idResult.id));
  if (!article) return Response.json({ error: "찾을 수 없는 기사예요." }, { status: 404 });
  const counted = await recordView(db, idResult.id, await ensureVisitorId());
  return Response.json({ counted }, { headers: { "Cache-Control": "no-store" } });
}
