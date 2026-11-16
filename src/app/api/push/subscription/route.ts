import { getDb } from "@/db";
import { requireAdmin } from "@/lib/admin-auth";
import { parseBody } from "@/lib/api";
import { subscriptionSchema, unsubscribeSchema } from "@/lib/push/payload";
import { removeSubscription, upsertSubscription } from "@/lib/push/send";

/** 이 기기의 알림 구독을 저장한다(같은 주소는 갱신). */
export async function POST(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const parsed = await parseBody(request, subscriptionSchema);
  if ("error" in parsed) return parsed.error;
  await upsertSubscription(getDb(), parsed.data);
  return Response.json({ subscribed: true });
}

/** 이 기기의 알림 구독을 지운다(없어도 성공). */
export async function DELETE(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const parsed = await parseBody(request, unsubscribeSchema);
  if ("error" in parsed) return parsed.error;
  await removeSubscription(getDb(), parsed.data.endpoint);
  return Response.json({ subscribed: false });
}
