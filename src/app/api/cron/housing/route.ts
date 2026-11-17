import { getDb } from "@/db";
import { requireCron } from "@/lib/cron-auth";
import { getDataGoKrServiceKey } from "@/lib/data-go-kr";
import { syncHousing } from "@/lib/housing/sync";

export const maxDuration = 60;

/** Vercel Cron: 매일 청약 정보 가져오기. 버튼(POST /api/housing/fetch)과 같은 syncHousing 을 쓴다. */
export async function GET(request: Request) {
  const denied = requireCron(request);
  if (denied) return denied;
  const key = getDataGoKrServiceKey();
  if ("error" in key) return key.error;

  const { since, results, images } = await syncHousing(getDb(), key.key);
  return Response.json({
    since,
    inserted: results.reduce((s, r) => s + r.inserted, 0),
    existing: results.reduce((s, r) => s + r.existing, 0),
    images,
    results,
  });
}
