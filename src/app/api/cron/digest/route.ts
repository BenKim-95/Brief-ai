import { getDb } from "@/db";
import { requireCron } from "@/lib/cron-auth";
import { getVapid } from "@/lib/push/config";
import { sendDigest } from "@/lib/push/digest";

export const maxDuration = 60;

/** Vercel Cron: 아침 수집이 끝난 뒤 하루 1회 새 소식 요약 알림을 보낸다. */
export async function GET(request: Request) {
  const denied = requireCron(request);
  if (denied) return denied;
  const v = getVapid();
  if ("error" in v) return v.error;
  return Response.json(await sendDigest(getDb(), v.vapid));
}
