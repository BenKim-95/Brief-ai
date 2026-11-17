import { getDb } from "@/db";
import { badRequest } from "@/lib/api";
import { listLatest } from "@/lib/news/queries";
import { toWidgetItem, widgetQuerySchema } from "@/lib/news/widget";

/**
 * 폰 위젯이 가져가는 최신 뉴스. 홈 화면에 이미 공개된 제목과 짧은 요약만 담고,
 * 비밀 값이나 사용자 정보는 없다(그래서 토큰 없이 열려 있다). `?limit=1..5`, 기본 3개.
 */
export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  const q = widgetQuerySchema.safeParse({ limit: sp.get("limit") ?? undefined });
  if (!q.success) return badRequest("limit은 1에서 5 사이의 숫자예요.");
  const rows = await listLatest(getDb(), q.data.limit);
  return Response.json(
    { items: rows.map(toWidgetItem) },
    // 위젯이 자주 불러도 DB에 부담이 없게 잠깐 캐시한다.
    { headers: { "Cache-Control": "public, max-age=60, s-maxage=300" } },
  );
}
