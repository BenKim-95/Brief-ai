import { cookies } from "next/headers";

/**
 * 로그인(Clerk, 8단계) 전까지 "이 브라우저"를 구분하는 익명 방문자 번호.
 * 무작위 UUID를 httpOnly 쿠키에 두고, DB의 user_id 칸에는 `v:<uuid>`로 적는다.
 * 저장함·마이페이지·커뮤니티 글처럼 사람마다 달라야 하는 데이터에 쓴다.
 * 쿠키를 지우거나 다른 기기에서 열면 다른 방문자로 보인다(로그인이 생기면 계정으로 옮길 수 있게 접두사를 붙였다).
 */
export const VISITOR_COOKIE = "brief_vid";
const ONE_YEAR_SECONDS = 365 * 24 * 3600;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** 쿠키 값이 올바른 UUID면 DB용 방문자 id(`v:<uuid>`), 아니면 null. */
export function toVisitorId(cookieValue: string | undefined): string | null {
  if (!cookieValue || !UUID.test(cookieValue)) return null;
  return `v:${cookieValue}`;
}

/** 이 요청의 방문자 id. 아직 쿠키가 없으면 null (읽기 전용: 쿠키를 만들지 않는다). */
export async function readVisitorId(): Promise<string | null> {
  const store = await cookies();
  return toVisitorId(store.get(VISITOR_COOKIE)?.value);
}

/** 방문자 id를 돌려주고, 아직 없으면 새로 만들어 쿠키로 심는다. Route Handler / Server Action에서만 쓴다. */
export async function ensureVisitorId(): Promise<string> {
  const store = await cookies();
  const existing = toVisitorId(store.get(VISITOR_COOKIE)?.value);
  if (existing) return existing;
  const fresh = crypto.randomUUID();
  store.set(VISITOR_COOKIE, fresh, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ONE_YEAR_SECONDS,
  });
  return `v:${fresh}`;
}
