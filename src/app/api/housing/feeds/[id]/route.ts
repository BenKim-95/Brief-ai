import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { housingFeeds } from "@/db/schema";
import { requireAdmin } from "@/lib/admin-auth";
import { badRequest, isUniqueViolation, parseBody, parseId } from "@/lib/api";
import { getDataGoKrServiceKey } from "@/lib/data-go-kr";
import { checkApplyhomeEndpoint } from "@/lib/housing/applyhome";
import { reclassifyHousingNotices } from "@/lib/housing/sync";
import { housingFeedUpdateSchema } from "@/lib/schemas";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Ctx) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const idResult = await parseId(params);
  if ("error" in idResult) return idResult.error;
  const parsed = await parseBody(request, housingFeedUpdateSchema);
  if ("error" in parsed) return parsed.error;
  if (Object.keys(parsed.data).length === 0) return badRequest("바꿀 값이 없어요.");

  const db = getDb();
  if (parsed.data.endpoint) {
    const [current] = await db
      .select({ endpoint: housingFeeds.endpoint })
      .from(housingFeeds)
      .where(eq(housingFeeds.id, idResult.id));
    if (current && current.endpoint !== parsed.data.endpoint) {
      const key = getDataGoKrServiceKey();
      if ("error" in key) return key.error;
      const check = await checkApplyhomeEndpoint(parsed.data.endpoint, key.key);
      if (!check.ok) return badRequest(`청약홈 API를 읽을 수 없어요: ${check.error}`);
    }
  }
  try {
    const [row] = await db
      .update(housingFeeds)
      .set(parsed.data)
      .where(eq(housingFeeds.id, idResult.id))
      .returning();
    if (!row) return Response.json({ error: "찾을 수 없어요." }, { status: 404 });
    // The feed name is part of the text category keywords match against.
    if (parsed.data.name !== undefined) await reclassifyHousingNotices(db);
    return Response.json(row);
  } catch (e) {
    if (isUniqueViolation(e)) return badRequest("이미 등록된 API 오퍼레이션이에요.");
    throw e;
  }
}

/** Notices from a deleted feed stay (feed_id → NULL) and are reclassified. */
export async function DELETE(request: Request, { params }: Ctx) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const idResult = await parseId(params);
  if ("error" in idResult) return idResult.error;
  const db = getDb();
  const [row] = await db
    .delete(housingFeeds)
    .where(eq(housingFeeds.id, idResult.id))
    .returning();
  if (!row) return Response.json({ error: "찾을 수 없어요." }, { status: 404 });
  await reclassifyHousingNotices(db);
  return new Response(null, { status: 204 });
}
