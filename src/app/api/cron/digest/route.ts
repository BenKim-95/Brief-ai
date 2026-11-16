import { getDb } from "@/db";
import { requireCron } from "@/lib/cron-auth";
import { readEmailConfig } from "@/lib/email/config";
import { readVapid } from "@/lib/push/config";
import { sendDigest } from "@/lib/push/digest";

export const maxDuration = 60;

/** Vercel Cron: 아침 수집이 끝난 뒤 하루 1회 새 소식 요약을 푸시와 이메일로 보낸다(설정된 채널만). */
export async function GET(request: Request) {
  const denied = requireCron(request);
  if (denied) return denied;
  const vapid = readVapid();
  const email = readEmailConfig();
  if (!vapid && !email) {
    return Response.json(
      {
        error:
          "서버에 푸시 키(NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT)도 이메일 설정(RESEND_API_KEY, RESEND_FROM, SITE_URL)도 없어요.",
      },
      { status: 503 },
    );
  }
  return Response.json(
    await sendDigest(getDb(), {
      push: vapid ? { vapid } : undefined,
      email: email ? { config: email } : undefined,
    }),
  );
}
