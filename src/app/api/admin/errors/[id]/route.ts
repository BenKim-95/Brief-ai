import { z } from "zod";
import { getDb } from "@/db";
import { requireAdmin } from "@/lib/admin-auth";
import { parseBody, parseId } from "@/lib/api";
import { STATUSES } from "@/lib/errors/code";
import { removeError, setStatus } from "@/lib/errors/store";

type Ctx = { params: Promise<{ id: string }> };

const patchSchema = z.object({ status: z.enum(STATUSES) });

/** 관리자: 오류 상태 바꾸기(처리 전 / 해결됨 / 무시). */
export async function PATCH(request: Request, { params }: Ctx) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const idResult = await parseId(params);
  if ("error" in idResult) return idResult.error;
  const parsed = await parseBody(request, patchSchema);
  if ("error" in parsed) return parsed.error;
  const ok = await setStatus(getDb(), idResult.id, parsed.data.status);
  if (!ok) return Response.json({ error: "찾을 수 없는 오류예요." }, { status: 404 });
  return Response.json({ status: parsed.data.status });
}

/** 관리자: 오류 기록 지우기. */
export async function DELETE(request: Request, { params }: Ctx) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const idResult = await parseId(params);
  if ("error" in idResult) return idResult.error;
  const ok = await removeError(getDb(), idResult.id);
  if (!ok) return Response.json({ error: "찾을 수 없는 오류예요." }, { status: 404 });
  return Response.json({ deleted: true });
}
