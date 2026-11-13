import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { housingNotices, savedHousingNotices } from "@/db/schema";
import { requireAdmin } from "@/lib/admin-auth";
import { parseId } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

/** Save a 청약 공고 (idempotent). `id` is the housing notice id. */
export async function PUT(request: Request, { params }: Ctx) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const idResult = await parseId(params);
  if ("error" in idResult) return idResult.error;
  const db = getDb();
  const [notice] = await db
    .select({ id: housingNotices.id })
    .from(housingNotices)
    .where(eq(housingNotices.id, idResult.id));
  if (!notice) return Response.json({ error: "찾을 수 없는 공고예요." }, { status: 404 });
  // Unique on (notice_id, user_id) NULLS NOT DISTINCT: a second save is a no-op.
  await db
    .insert(savedHousingNotices)
    .values({ noticeId: idResult.id, userId: null })
    .onConflictDoNothing();
  return Response.json({ saved: true });
}

/** Un-save a 청약 공고 (idempotent). */
export async function DELETE(request: Request, { params }: Ctx) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const idResult = await parseId(params);
  if ("error" in idResult) return idResult.error;
  await getDb()
    .delete(savedHousingNotices)
    .where(and(eq(savedHousingNotices.noticeId, idResult.id), isNull(savedHousingNotices.userId)));
  return Response.json({ saved: false });
}
