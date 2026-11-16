import { getDb } from "@/db";
import { requireAdmin } from "@/lib/admin-auth";
import { getVapid } from "@/lib/push/config";
import { sendToAll } from "@/lib/push/send";

/** 저장된 모든 기기로 시험 알림을 보낸다. 알림이 제대로 오는지 확인하는 용도예요. */
export async function POST(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const v = getVapid();
  if ("error" in v) return v.error;
  const result = await sendToAll(getDb(), v.vapid, {
    title: "브리프 알림 시험",
    body: "알림이 잘 도착했어요.",
    url: "/",
  });
  return Response.json(result);
}
