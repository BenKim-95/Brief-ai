import { z } from "zod";
import { getDb, hasDatabaseUrl } from "@/db";
import { cleanVisitPath, isBotAgent, recordVisit, VISIT_SOURCES } from "@/lib/traffic/store";
import { ensureVisitorId } from "@/lib/visitor";

const bodySchema = z.object({
  path: z.string().max(300),
  source: z.enum(VISIT_SOURCES).default("web"),
});

/**
 * 화면을 연 것을 1회 기록한다(하루 방문자수·트래픽 집계용). 로그인·토큰 없이 쓰므로
 * 다른 사이트에서 보낸 요청, 봇, 관리 화면·API 경로는 세지 않는다. 세지 않을 때도 204 로 조용히 답한다.
 */
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin) {
    let ok = false;
    try {
      ok = new URL(origin).host === new URL(request.url).host;
    } catch {}
    if (!ok) return Response.json({ error: "허용되지 않는 요청이에요." }, { status: 403 });
  }
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return Response.json({ error: "JSON 형식이 올바르지 않아요." }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return Response.json({ error: "요청 내용이 올바르지 않아요." }, { status: 400 });

  const path = cleanVisitPath(parsed.data.path);
  if (!path || isBotAgent(request.headers.get("user-agent")) || !hasDatabaseUrl()) {
    return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  }
  try {
    await recordVisit(getDb(), { visitorId: await ensureVisitorId(), path, source: parsed.data.source });
  } catch {
    // 집계 실패가 화면을 막으면 안 된다.
  }
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
