import Anthropic from "@anthropic-ai/sdk";
import { getDb } from "@/db";
import { requireAdmin } from "@/lib/admin-auth";
import { syncNews } from "@/lib/news/sync";

export const maxDuration = 60;

/** "뉴스 가져오기". One failing source or batch doesn't stop the rest. */
export async function POST(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      { error: "서버에 ANTHROPIC_API_KEY가 설정되지 않았어요." },
      { status: 503 },
    );
  }
  const result = await syncNews(getDb(), new Anthropic());
  return Response.json(result);
}
