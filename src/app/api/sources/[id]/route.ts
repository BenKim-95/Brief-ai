import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { sources } from "@/db/schema";
import { requireAdmin } from "@/lib/admin-auth";
import { badRequest, isUniqueViolation, parseBody, parseId } from "@/lib/api";
import { checkFeed } from "@/lib/rss";
import { sourceUpdateSchema } from "@/lib/schemas";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Ctx) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const idResult = await parseId(params);
  if ("error" in idResult) return idResult.error;
  const parsed = await parseBody(request, sourceUpdateSchema);
  if ("error" in parsed) return parsed.error;
  if (Object.keys(parsed.data).length === 0) {
    return badRequest("바꿀 값이 없어요.");
  }

  if (parsed.data.url) {
    const check = await checkFeed(parsed.data.url);
    if (!check.ok) return badRequest(`RSS를 읽을 수 없어요: ${check.error}`);
  }
  try {
    const [row] = await getDb()
      .update(sources)
      .set(parsed.data)
      .where(eq(sources.id, idResult.id))
      .returning();
    if (!row) return Response.json({ error: "찾을 수 없어요." }, { status: 404 });
    return Response.json(row);
  } catch (e) {
    if (isUniqueViolation(e)) return badRequest("이미 등록된 RSS 주소예요.");
    throw e;
  }
}

export async function DELETE(request: Request, { params }: Ctx) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const idResult = await parseId(params);
  if ("error" in idResult) return idResult.error;
  const [row] = await getDb()
    .delete(sources)
    .where(eq(sources.id, idResult.id))
    .returning();
  if (!row) return Response.json({ error: "찾을 수 없어요." }, { status: 404 });
  return new Response(null, { status: 204 });
}
