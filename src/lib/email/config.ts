/**
 * 이메일(Resend) 설정. 서버 코드에서만 사용한다. 키 값은 어디에도 출력하지 않는다.
 * - RESEND_API_KEY: Resend API 키
 * - RESEND_FROM: 보내는 주소. 예) "브리프 <noreply@내도메인>" (Resend에서 도메인 인증 필요)
 * - SITE_URL: 배포 주소. 메일 안의 링크(홈, 수신 해제)에 쓴다. 예) https://brief.example.com
 */
export type EmailConfig = { apiKey: string; from: string; siteUrl: string };

export function readEmailConfig(env: NodeJS.ProcessEnv = process.env): EmailConfig | null {
  const apiKey = env.RESEND_API_KEY?.trim();
  const from = env.RESEND_FROM?.trim();
  const site = env.SITE_URL?.trim().replace(/\/+$/, "");
  if (!apiKey || !from || !site) return null;
  if (!/^https?:\/\/[^/\s]+$/.test(site)) return null; // 경로 없는 주소만
  // 줄바꿈이 섞이면 헤더로 해석될 수 있어 거부한다.
  if (/[\r\n]/.test(from)) return null;
  return { apiKey, from, siteUrl: site };
}

export function getEmailConfig(): { config: EmailConfig } | { error: Response } {
  const config = readEmailConfig();
  if (!config) {
    return {
      error: Response.json(
        {
          error:
            "서버에 이메일 설정이 없어요. RESEND_API_KEY, RESEND_FROM, SITE_URL(https://… 형식, 경로 없이. 로컬 시험은 http://localhost:3000)을 확인해 주세요. 값이 비어 있어도 안 돼요.",
        },
        { status: 503 },
      ),
    };
  }
  return { config };
}
