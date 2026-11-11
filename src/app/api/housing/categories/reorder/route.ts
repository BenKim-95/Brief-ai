import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { housingCategories } from "@/db/schema";
import { requireAdmin } from "@/lib/admin-auth";
import { parseBody } from "@/lib/api";
import { reclassifyHousingNotices } from "@/lib/housing/sync";
import { categoryReorderSchema } from "@/lib/schemas";

/** Body: { ids: number[] }. Order is also match priority, so reclassify. */
export async function PUT(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const parsed = await parseBody(request, categoryReorderSchema);
  if ("error" in parsed) return parsed.error;

  const db = getDb();
  await Promise.all(
    parsed.data.ids.map((id, index) =>
      db
        .update(housingCategories)
        .set({ sortOrder: index })
        .where(eq(housingCategories.id, id)),
    ),
  );
  await reclassifyHousingNotices(db);
  return new Response(null, { status: 204 });
}
