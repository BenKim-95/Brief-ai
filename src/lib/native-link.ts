/**
 * 앱(Capacitor)이 위젯·알림 등에서 받은 주소를 앱 안 경로로 바꾼다.
 * 우리 사이트(같은 origin) 주소만 허용하고, 다른 사이트나 이상한 값이면 null(이동하지 않는다).
 */
export function pathFromAppUrl(url: string, origin: string): string | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.origin !== origin) return null;
  // 경로가 "//"로 시작하면 router 가 다른 사이트로 해석할 수 있어 거부한다.
  if (u.pathname.startsWith("//")) return null;
  return `${u.pathname}${u.search}`;
}
