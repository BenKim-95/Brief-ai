import { timingSafeEqual } from "node:crypto";

export const ADMIN_TOKEN_HEADER = "x-admin-token";

/** Returns an error Response if the request is not authorized, otherwise null. */
export function requireAdmin(request: Request): Response | null {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) {
    return Response.json(
      { error: "서버에 ADMIN_TOKEN이 설정되지 않았어요." },
      { status: 503 },
    );
  }
  const given = request.headers.get(ADMIN_TOKEN_HEADER) ?? "";
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return Response.json({ error: "인증에 실패했어요." }, { status: 401 });
  }
  return null;
}
