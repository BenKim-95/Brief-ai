import { getDb } from "@/db";
import { parseBody } from "@/lib/api";
import { getProfile, profileUpdateSchema, saveProfile } from "@/lib/my/profile";
import { ensureVisitorId, readVisitorId } from "@/lib/visitor";

/** 이 방문자의 프로필(닉네임·관심 카테고리). 로그인·토큰 없이 쓴다. */
export async function GET() {
  const profile = await getProfile(getDb(), await readVisitorId());
  return Response.json(profile, { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(request: Request) {
  const parsed = await parseBody(request, profileUpdateSchema);
  if ("error" in parsed) return parsed.error;
  const visitorId = await ensureVisitorId();
  const saved = await saveProfile(getDb(), visitorId, parsed.data);
  return Response.json(saved);
}
