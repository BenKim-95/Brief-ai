import Anthropic from "@anthropic-ai/sdk";
import { getDb } from "@/db";
import { requireCron } from "@/lib/cron-auth";
import { pruneErrors } from "@/lib/errors/store";
import { pruneViews } from "@/lib/news/five-minute";
import { syncNews } from "@/lib/news/sync";
import { pruneVisits } from "@/lib/traffic/store";

export const maxDuration = 60;

/** Vercel Cron: 매일 뉴스 가져오기. 버튼(POST /api/news/fetch)과 같은 syncNews 를 쓴다. */
export async function GET(request: Request) {
  const denied = requireCron(request);
  if (denied) return denied;
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "서버에 ANTHROPIC_API_KEY가 설정되지 않았어요." }, { status: 503 });
  }
  const db = getDb();
  const result = await syncNews(db, new Anthropic());
  // 5분 이슈용 조회 기록은 30일만 보관한다. 정리에 실패해도 수집 결과는 그대로 돌려준다.
  const prunedViews = await pruneViews(db).catch(() => null);
  const prunedErrors = await pruneErrors(db).catch(() => null);
  const prunedVisits = await pruneVisits(db).catch(() => null);
  return Response.json({ ...result, prunedViews, prunedErrors, prunedVisits });
}
