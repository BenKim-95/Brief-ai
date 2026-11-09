import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { categories } from "@/db/schema";
import { requireAdmin } from "@/lib/admin-auth";
import { badRequest, isUniqueViolation, parseBody, parseId } from "@/lib/api";
import { categoryUpdateSchema } from "@/lib/schemas";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Ctx) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const idResult = await parseId(params);
  if ("error" in idResult) return idResult.error;
  const parsed = await parseBody(request, categoryUpdateSchema);
  if ("error" in parsed) return parsed.error;
  if (Object.keys(parsed.data).length === 0) {
    return badRequest("바꿀 값이 없어요.");
  }
  try {
    const [row] = await getDb()
      .update(categories)
      .set(parsed.data)
      .where(eq(categories.id, idResult.id))
      .returning();
    if (!row) return Response.json({ error: "찾을 수 없어요." }, { status: 404 });
    return Response.json(row);
  } catch (e) {
    if (isUniqueViolation(e)) return badRequest("이미 있는 카테고리 이름이에요.");
    throw e;
  }
}

// TODO(step 3): once `articles` exists, its category_id FK must be
// ON DELETE SET NULL so deleted categories fall back to "미분류".
export async function DELETE(request: Request, { params }: Ctx) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const idResult = await parseId(params);
  if ("error" in idResult) return idResult.error;
  const [row] = await getDb()
    .delete(categories)
    .where(eq(categories.id, idResult.id))
    .returning();
  if (!row) return Response.json({ error: "찾을 수 없어요." }, { status: 404 });
  return new Response(null, { status: 204 });
}
