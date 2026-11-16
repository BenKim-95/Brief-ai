import Anthropic from "@anthropic-ai/sdk";
import { getDb } from "@/db";
import { requireCron } from "@/lib/cron-auth";
import { syncNews } from "@/lib/news/sync";

export const maxDuration = 60;

/** Vercel Cron: 매일 뉴스 가져오기. 버튼(POST /api/news/fetch)과 같은 syncNews 를 쓴다. */
export async function GET(request: Request) {
  const denied = requireCron(request);
  if (denied) return denied;
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "서버에 ANTHROPIC_API_KEY가 설정되지 않았어요." }, { status: 503 });
  }
  const result = await syncNews(getDb(), new Anthropic());
  return Response.json(result);
}
