import { getDb } from "@/db";
import { requireAdmin } from "@/lib/admin-auth";
import { TRAFFIC_RANGES, getTraffic, type TrafficRange } from "@/lib/traffic/store";

/** 하루 방문자수·페이지뷰·시간대·인기 화면 (관리자). `?days=7|14|30` (기본 14). */
export async function GET(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const asked = Number(new URL(request.url).searchParams.get("days"));
  const range = (TRAFFIC_RANGES as readonly number[]).includes(asked) ? (asked as TrafficRange) : 14;
  try {
    const report = await getTraffic(getDb(), range);
    return Response.json(report, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    // 새 테이블(site_visits)의 마이그레이션이 아직 적용되지 않았을 때 알아보기 쉽게 알려 준다.
    const text = `${(e as Error).message} ${(e as { cause?: Error }).cause?.message ?? ""}`;
    if (/site_visits/.test(text) && /does not exist/.test(text)) {
      return Response.json({ error: "방문 기록 테이블이 아직 없어요. 데이터베이스에 `npm run db:migrate` 를 먼저 실행해 주세요." }, { status: 503 });
    }
    throw e;
  }
}
