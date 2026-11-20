import { getDb } from "@/db";
import { parseBody } from "@/lib/api";
import { createPost } from "@/lib/community/queries";
import { postCreateSchema } from "@/lib/community/rules";
import { ensureVisitorId } from "@/lib/visitor";

/** 커뮤니티 글쓰기. 로그인 없이 방문자(브라우저)별로 쓰고, 도배 방지로 1시간에 5개까지. */
export async function POST(request: Request) {
  const parsed = await parseBody(request, postCreateSchema);
  if ("error" in parsed) return parsed.error;
  const res = await createPost(getDb(), await ensureVisitorId(), parsed.data);
  if (!res.ok) return Response.json({ error: res.error }, { status: res.status });
  return Response.json(res.value, { status: 201 });
}
