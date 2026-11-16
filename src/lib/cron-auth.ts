import { timingSafeEqual } from "node:crypto";

/**
 * Vercel Cron 호출 확인. Vercel은 환경변수 CRON_SECRET 이 있으면
 * `Authorization: Bearer <CRON_SECRET>` 헤더를 붙여 GET 으로 호출한다.
 * 관리 토큰(x-admin-token)과는 별개 값이다. 통과하면 null, 아니면 오류 응답.
 */
export function requireCron(request: Request): Response | null {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return Response.json({ error: "서버에 CRON_SECRET이 설정되지 않았어요." }, { status: 503 });
  }
  const given = request.headers.get("authorization") ?? "";
  const a = Buffer.from(given);
  const b = Buffer.from(`Bearer ${secret}`);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return Response.json({ error: "인증에 실패했어요." }, { status: 401 });
  }
  return null;
}
