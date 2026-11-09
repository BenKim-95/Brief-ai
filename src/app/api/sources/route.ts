import { asc } from "drizzle-orm";
import { getDb } from "@/db";
import { sources } from "@/db/schema";
import { requireAdmin } from "@/lib/admin-auth";
import { badRequest, isUniqueViolation, parseBody } from "@/lib/api";
import { checkFeed } from "@/lib/rss";
import { sourceCreateSchema } from "@/lib/schemas";

export async function GET(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const rows = await getDb().select().from(sources).orderBy(asc(sources.id));
  return Response.json(rows);
}

export async function POST(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const parsed = await parseBody(request, sourceCreateSchema);
  if ("error" in parsed) return parsed.error;

  const check = await checkFeed(parsed.data.url);
  if (!check.ok) {
    return badRequest(`RSS를 읽을 수 없어요: ${check.error}`);
  }
  try {
    const [row] = await getDb().insert(sources).values(parsed.data).returning();
    return Response.json(row, { status: 201 });
  } catch (e) {
    if (isUniqueViolation(e)) return badRequest("이미 등록된 RSS 주소예요.");
    throw e;
  }
}
