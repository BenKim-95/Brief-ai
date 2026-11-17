import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { articles } from "@/db/schema";
import { badRequest, parseId } from "@/lib/api";
import { buildIcs } from "@/lib/ics";
import { remindQuerySchema, resolveRemindAt } from "@/lib/news/reminder";

type Ctx = { params: Promise<{ id: string }> };

/**
 * "읽을 시간 알림" 캘린더 파일. 기사 제목과 요약, 원문 링크만 담는다(기사 본문은 싣지 않는다).
 * 시간은 `?when=evening|tomorrow|weekend` 또는 `?date=YYYY-MM-DD`(그 날 오전 9시, 한국 시간).
 */
export async function GET(request: Request, { params }: Ctx) {
  const idResult = await parseId(params);
  if ("error" in idResult) return idResult.error;

  const sp = new URL(request.url).searchParams;
  const query = remindQuerySchema.safeParse({
    when: sp.get("when") ?? undefined,
    date: sp.get("date") ?? undefined,
  });
  if (!query.success) return badRequest("시간을 다시 골라 주세요.", query.error.issues);
  const remind = resolveRemindAt(query.data, new Date());
  if (!remind.ok) return badRequest(remind.error);

  const [a] = await getDb()
    .select({ id: articles.id, url: articles.url, titleKo: articles.titleKo, summaryKo: articles.summaryKo })
    .from(articles)
    .where(eq(articles.id, idResult.id));
  if (!a) return Response.json({ error: "찾을 수 없는 기사예요." }, { status: 404 });

  const url = /^https?:\/\//i.test(a.url) ? a.url : undefined;
  const ics = buildIcs([
    {
      uid: `article-${a.id}-${remind.at.getTime()}@brief`,
      startAt: remind.at,
      title: `[읽을 기사] ${a.titleKo}`,
      description: [a.summaryKo, url].filter(Boolean).join("\n"),
      url,
    },
  ]);
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="article-${a.id}.ics"`,
      "Cache-Control": "no-store",
    },
  });
}
