import { asc } from "drizzle-orm";
import { getDb } from "@/db";
import { housingFeeds } from "@/db/schema";
import { requireAdmin } from "@/lib/admin-auth";
import { badRequest, isUniqueViolation, parseBody } from "@/lib/api";
import { getDataGoKrServiceKey } from "@/lib/data-go-kr";
import { checkApplyhomeEndpoint } from "@/lib/housing/applyhome";
import { reclassifyHousingNotices } from "@/lib/housing/sync";
import { housingFeedCreateSchema } from "@/lib/schemas";

export async function GET(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const rows = await getDb()
    .select()
    .from(housingFeeds)
    .orderBy(asc(housingFeeds.id));
  return Response.json(rows);
}

export async function POST(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const parsed = await parseBody(request, housingFeedCreateSchema);
  if ("error" in parsed) return parsed.error;
  const key = getDataGoKrServiceKey();
  if ("error" in key) return key.error;

  const check = await checkApplyhomeEndpoint(parsed.data.endpoint, key.key);
  if (!check.ok) return badRequest(`청약홈 API를 읽을 수 없어요: ${check.error}`);

  const db = getDb();
  try {
    const [row] = await db.insert(housingFeeds).values(parsed.data).returning();
    await reclassifyHousingNotices(db);
    return Response.json(row, { status: 201 });
  } catch (e) {
    if (isUniqueViolation(e)) return badRequest("이미 등록된 API 오퍼레이션이에요.");
    throw e;
  }
}
