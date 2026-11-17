import { getDb } from "@/db";
import { requireAdmin } from "@/lib/admin-auth";
import { getDataGoKrServiceKey } from "@/lib/data-go-kr";
import { syncHousing } from "@/lib/housing/sync";

export const maxDuration = 60;

/** "청약 정보 가져오기". One failing feed doesn't stop the others. */
export async function POST(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const key = getDataGoKrServiceKey();
  if ("error" in key) return key.error;

  const { since, results, images } = await syncHousing(getDb(), key.key);
  return Response.json({
    since,
    inserted: results.reduce((s, r) => s + r.inserted, 0),
    updated: results.reduce((s, r) => s + r.updated, 0),
    unchanged: results.reduce((s, r) => s + r.unchanged, 0),
    images,
    results,
  });
}
