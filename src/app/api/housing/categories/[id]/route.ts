import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { housingCategories } from "@/db/schema";
import { requireAdmin } from "@/lib/admin-auth";
import { badRequest, isUniqueViolation, parseBody, parseId } from "@/lib/api";
import { reclassifyHousingNotices } from "@/lib/housing/sync";
import { housingCategoryUpdateSchema } from "@/lib/schemas";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Ctx) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const idResult = await parseId(params);
  if ("error" in idResult) return idResult.error;
  const parsed = await parseBody(request, housingCategoryUpdateSchema);
  if ("error" in parsed) return parsed.error;
  if (Object.keys(parsed.data).length === 0) return badRequest("바꿀 값이 없어요.");

  const db = getDb();
  try {
    const [row] = await db
      .update(housingCategories)
      .set(parsed.data)
      .where(eq(housingCategories.id, idResult.id))
      .returning();
    if (!row) return Response.json({ error: "찾을 수 없어요." }, { status: 404 });
    if (parsed.data.keywords !== undefined) await reclassifyHousingNotices(db);
    return Response.json(row);
  } catch (e) {
    if (isUniqueViolation(e)) return badRequest("이미 있는 카테고리 이름이에요.");
    throw e;
  }
}

/** FK is ON DELETE SET NULL; reclassifying lets another category pick them up. */
export async function DELETE(request: Request, { params }: Ctx) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const idResult = await parseId(params);
  if ("error" in idResult) return idResult.error;
  const db = getDb();
  const [row] = await db
    .delete(housingCategories)
    .where(eq(housingCategories.id, idResult.id))
    .returning();
  if (!row) return Response.json({ error: "찾을 수 없어요." }, { status: 404 });
  await reclassifyHousingNotices(db);
  return new Response(null, { status: 204 });
}
