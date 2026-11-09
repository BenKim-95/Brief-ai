import { asc, max } from "drizzle-orm";
import { getDb } from "@/db";
import { categories } from "@/db/schema";
import { requireAdmin } from "@/lib/admin-auth";
import { badRequest, isUniqueViolation, parseBody } from "@/lib/api";
import { categoryCreateSchema } from "@/lib/schemas";

export async function GET(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const rows = await getDb()
    .select()
    .from(categories)
    .orderBy(asc(categories.sortOrder), asc(categories.id));
  return Response.json(rows);
}

export async function POST(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const parsed = await parseBody(request, categoryCreateSchema);
  if ("error" in parsed) return parsed.error;

  const db = getDb();
  const [{ value }] = await db
    .select({ value: max(categories.sortOrder) })
    .from(categories);
  try {
    const [row] = await db
      .insert(categories)
      .values({ ...parsed.data, sortOrder: (value ?? -1) + 1 })
      .returning();
    return Response.json(row, { status: 201 });
  } catch (e) {
    if (isUniqueViolation(e)) return badRequest("이미 있는 카테고리 이름이에요.");
    throw e;
  }
}
