import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { categories } from "@/db/schema";
import { requireAdmin } from "@/lib/admin-auth";
import { parseBody } from "@/lib/api";
import { categoryReorderSchema } from "@/lib/schemas";

/** Body: { ids: number[] } in the desired display order. */
export async function PUT(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const parsed = await parseBody(request, categoryReorderSchema);
  if ("error" in parsed) return parsed.error;

  const db = getDb();
  await Promise.all(
    parsed.data.ids.map((id, index) =>
      db
        .update(categories)
        .set({ sortOrder: index })
        .where(eq(categories.id, id)),
    ),
  );
  return new Response(null, { status: 204 });
}
