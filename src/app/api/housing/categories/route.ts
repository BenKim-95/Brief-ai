import { asc, eq, max, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { housingCategories, housingFeeds, housingNotices } from "@/db/schema";
import { requireAdmin } from "@/lib/admin-auth";
import { badRequest, isUniqueViolation, parseBody } from "@/lib/api";
import { reclassifyHousingNotices } from "@/lib/housing/sync";
import { housingCategoryCreateSchema } from "@/lib/schemas";

/**
 * Returns categories plus the type labels seen in stored notices, so the admin
 * can pick keywords that actually match.
 */
export async function GET(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const db = getDb();
  const categories = await db
    .select()
    .from(housingCategories)
    .orderBy(asc(housingCategories.sortOrder), asc(housingCategories.id));
  const labels = await db
    .select({
      feedName: housingFeeds.name,
      typeLabel: housingNotices.typeLabel,
      categoryId: housingNotices.categoryId,
      count: sql<number>`count(*)::int`,
    })
    .from(housingNotices)
    .leftJoin(housingFeeds, eq(housingNotices.feedId, housingFeeds.id))
    .groupBy(housingFeeds.name, housingNotices.typeLabel, housingNotices.categoryId)
    .orderBy(sql`count(*) desc`);
  return Response.json({ categories, labels });
}

export async function POST(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const parsed = await parseBody(request, housingCategoryCreateSchema);
  if ("error" in parsed) return parsed.error;

  const db = getDb();
  const [{ value }] = await db
    .select({ value: max(housingCategories.sortOrder) })
    .from(housingCategories);
  try {
    const [row] = await db
      .insert(housingCategories)
      .values({ ...parsed.data, sortOrder: (value ?? -1) + 1 })
      .returning();
    await reclassifyHousingNotices(db);
    return Response.json(row, { status: 201 });
  } catch (e) {
    if (isUniqueViolation(e)) return badRequest("이미 있는 카테고리 이름이에요.");
    throw e;
  }
}
