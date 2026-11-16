/**
 * Web Push(VAPID) 키 접근. 서버 코드에서만 사용한다.
 * 공개키는 브라우저에도 내려가지만 개인키는 서버 환경변수에만 둔다.
 * 키가 없으면 503으로 알려 주고, 값 자체는 어디에도 출력하지 않는다.
 */
export type VapidConfig = { subject: string; publicKey: string; privateKey: string };

export function readVapid(env: NodeJS.ProcessEnv = process.env): VapidConfig | null {
  const publicKey = env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const privateKey = env.VAPID_PRIVATE_KEY?.trim();
  const subject = env.VAPID_SUBJECT?.trim();
  if (!publicKey || !privateKey || !subject) return null;
  // 푸시 서비스가 연락할 주소여야 한다: mailto: 또는 https:
  if (!/^(mailto:|https:\/\/)/.test(subject)) return null;
  return { subject, publicKey, privateKey };
}

export function getVapid(): { vapid: VapidConfig } | { error: Response } {
  const vapid = readVapid();
  if (!vapid) {
    return {
      error: Response.json(
        {
          error:
            "서버에 푸시 키가 설정되지 않았어요. NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT(mailto: 또는 https:)를 확인해 주세요.",
        },
        { status: 503 },
      ),
    };
  }
  return { vapid };
}
