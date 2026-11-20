import { getDb } from "@/db";
import { requireAdmin } from "@/lib/admin-auth";
import { parseId } from "@/lib/api";
import { deletePost } from "@/lib/community/queries";
import { readVisitorId } from "@/lib/visitor";

type Ctx = { params: Promise<{ id: string }> };

/** 글 삭제. 쓴 사람(같은 브라우저) 또는 관리자(x-admin-token)만 지울 수 있다. */
export async function DELETE(request: Request, { params }: Ctx) {
  const idResult = await parseId(params);
  if ("error" in idResult) return idResult.error;
  const admin = request.headers.has("x-admin-token") && requireAdmin(request) === null;
  const ok = await deletePost(getDb(), idResult.id, { visitorId: await readVisitorId(), admin });
  if (!ok) return Response.json({ error: "지울 수 없는 글이에요. 내가 쓴 글만 지울 수 있어요." }, { status: 404 });
  return Response.json({ deleted: true });
}
