import { getDb } from "@/db";
import { requireAdmin } from "@/lib/admin-auth";
import { parseBody } from "@/lib/api";
import { listHidden, moderate } from "@/lib/community/queries";
import { adminActionSchema } from "@/lib/community/rules";

/** 관리자: 신고로 가려진 글·댓글 목록. */
export async function GET(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  return Response.json(await listHidden(getDb()));
}

/** 관리자: 가려진 글·댓글을 되살리거나(restore) 지운다(delete). */
export async function POST(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const parsed = await parseBody(request, adminActionSchema);
  if ("error" in parsed) return parsed.error;
  const ok = await moderate(getDb(), parsed.data.kind, parsed.data.id, parsed.data.action);
  if (!ok) return Response.json({ error: "처리할 수 없는 항목이에요." }, { status: 404 });
  return Response.json({ done: true });
}
