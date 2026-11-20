import Anthropic from "@anthropic-ai/sdk";
import { getDb } from "@/db";
import { requireAdmin } from "@/lib/admin-auth";
import { backfillInsights } from "@/lib/news/insights";

export const maxDuration = 60;

/** "AI 해설 채우기": 해설이 없는 기존 기사에 3줄을 만든다(관리자). */
export async function POST(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "서버에 ANTHROPIC_API_KEY가 설정되지 않았어요." }, { status: 503 });
  }
  return Response.json(await backfillInsights(getDb(), new Anthropic()));
}
