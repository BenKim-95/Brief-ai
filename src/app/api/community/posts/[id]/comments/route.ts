import { getDb } from "@/db";
import { parseBody, parseId } from "@/lib/api";
import { createComment } from "@/lib/community/queries";
import { commentCreateSchema } from "@/lib/community/rules";
import { ensureVisitorId } from "@/lib/visitor";

type Ctx = { params: Promise<{ id: string }> };

/** 댓글 쓰기. 1시간에 20개까지. */
export async function POST(request: Request, { params }: Ctx) {
  const idResult = await parseId(params);
  if ("error" in idResult) return idResult.error;
  const parsed = await parseBody(request, commentCreateSchema);
  if ("error" in parsed) return parsed.error;
  const res = await createComment(getDb(), await ensureVisitorId(), idResult.id, parsed.data.body);
  if (!res.ok) return Response.json({ error: res.error }, { status: res.status });
  return Response.json(res.value, { status: 201 });
}
