import { getDb } from "@/db";
import { requireAdmin } from "@/lib/admin-auth";
import { ERROR_SOURCES, STATUSES, type ErrorSource, type ErrorStatus } from "@/lib/errors/code";
import { checkHealth, listErrors, summarize } from "@/lib/errors/store";

/** 관리자: 오류 코드 목록 + 요약 + 서버 점검. ?status=open|resolved|ignored&source=web|app|server */
export async function GET(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const sp = new URL(request.url).searchParams;
  const status = sp.get("status");
  const source = sp.get("source");
  const db = getDb();
  const [items, summary, health] = await Promise.all([
    listErrors(db, {
      status: (STATUSES as readonly string[]).includes(status ?? "") ? (status as ErrorStatus) : undefined,
      source: (ERROR_SOURCES as readonly string[]).includes(source ?? "") ? (source as ErrorSource) : undefined,
    }),
    summarize(db),
    checkHealth(db),
  ]);
  return Response.json({ items, summary, health }, { headers: { "Cache-Control": "no-store" } });
}
