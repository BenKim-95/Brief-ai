import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { housingNotices } from "@/db/schema";
import { parseId } from "@/lib/api";
import { buildIcs, type IcsEvent } from "@/lib/ics";

type Ctx = { params: Promise<{ id: string }> };

const NOTE = "정확한 자격·일정은 청약홈 공고문을 확인해 주세요.";

/** Calendar file with the receipt period and the winner announcement day. */
export async function GET(_request: Request, { params }: Ctx) {
  const idResult = await parseId(params);
  if ("error" in idResult) return idResult.error;
  const [n] = await getDb()
    .select()
    .from(housingNotices)
    .where(eq(housingNotices.id, idResult.id));
  if (!n) return Response.json({ error: "찾을 수 없어요." }, { status: 404 });

  const url = n.detailUrl ?? undefined;
  const description = [n.address, n.detailUrl, NOTE].filter(Boolean).join("\n");
  const events: IcsEvent[] = [];
  const start = n.receiptStart ?? n.receiptEnd;
  if (start) {
    events.push({
      uid: `housing-${n.externalId}-receipt@brief`,
      date: start,
      endDate: n.receiptEnd && n.receiptEnd >= start ? n.receiptEnd : undefined,
      title: `[청약 접수] ${n.name}`,
      description,
      url,
    });
  }
  if (n.winnerOn) {
    events.push({
      uid: `housing-${n.externalId}-winner@brief`,
      date: n.winnerOn,
      title: `[당첨자 발표] ${n.name}`,
      description,
      url,
    });
  }
  if (events.length === 0) {
    return Response.json({ error: "캘린더에 넣을 일정이 없어요." }, { status: 404 });
  }
  return new Response(buildIcs(events), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="housing-${n.id}.ics"`,
    },
  });
}
