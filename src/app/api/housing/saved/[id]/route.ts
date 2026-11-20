import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { housingNotices, savedHousingNotices } from "@/db/schema";
import { parseId } from "@/lib/api";
import { ensureVisitorId, readVisitorId } from "@/lib/visitor";

type Ctx = { params: Promise<{ id: string }> };

/** 이 방문자의 저장함에 청약 공고를 담는다(여러 번 눌러도 한 번만). `id`는 공고 id. */
export async function PUT(_request: Request, { params }: Ctx) {
  const idResult = await parseId(params);
  if ("error" in idResult) return idResult.error;
  const db = getDb();
  const [notice] = await db
    .select({ id: housingNotices.id })
    .from(housingNotices)
    .where(eq(housingNotices.id, idResult.id));
  if (!notice) return Response.json({ error: "찾을 수 없는 공고예요." }, { status: 404 });
  const visitorId = await ensureVisitorId();
  await db
    .insert(savedHousingNotices)
    .values({ noticeId: idResult.id, userId: visitorId })
    .onConflictDoNothing();
  return Response.json({ saved: true });
}

/** 이 방문자의 저장함에서 청약 공고를 뺀다(없어도 성공). */
export async function DELETE(_request: Request, { params }: Ctx) {
  const idResult = await parseId(params);
  if ("error" in idResult) return idResult.error;
  const visitorId = await readVisitorId();
  if (visitorId) {
    await getDb()
      .delete(savedHousingNotices)
      .where(and(eq(savedHousingNotices.noticeId, idResult.id), eq(savedHousingNotices.userId, visitorId)));
  }
  return Response.json({ saved: false });
}
