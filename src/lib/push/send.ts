import { eq, inArray } from "drizzle-orm";
import { sendNotification } from "web-push";
import type { getDb } from "@/db";
import { pushSubscriptions } from "@/db/schema";
import type { VapidConfig } from "./config";
import type { PushPayload } from "./payload";

type Db = ReturnType<typeof getDb>;
type Sender = (
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: string,
  options: { TTL: number; vapidDetails: VapidConfig },
) => Promise<unknown>;

export type SendResult = { sent: number; removed: number; failed: number };

/** 푸시 서비스가 "이 구독은 더 이상 없다"고 알려 주는 상태 코드 */
export function isGone(error: unknown): boolean {
  const code = (error as { statusCode?: number } | null)?.statusCode;
  return code === 404 || code === 410;
}

/**
 * 저장된 모든 구독에 알림을 보낸다. 없어진 구독(404/410)은 DB에서 지우고, 그 밖의 실패는 센다.
 * `send`는 테스트에서 바꿔 끼울 수 있다.
 */
export async function sendToAll(
  db: Db,
  vapid: VapidConfig,
  payload: PushPayload,
  send: Sender = sendNotification as Sender,
): Promise<SendResult> {
  const subs = await db.select().from(pushSubscriptions);
  const body = JSON.stringify(payload);
  const gone: number[] = [];
  let sent = 0;
  let failed = 0;

  // 구독 수가 적은 개인용 앱이라 한꺼번에 보낸다.
  await Promise.all(
    subs.map(async (s) => {
      try {
        await send({ endpoint: s.endpoint, keys: s.keys }, body, { TTL: 60 * 60 * 12, vapidDetails: vapid });
        sent++;
      } catch (e) {
        if (isGone(e)) gone.push(s.id);
        else failed++;
      }
    }),
  );

  if (gone.length > 0) await db.delete(pushSubscriptions).where(inArray(pushSubscriptions.id, gone));
  return { sent, removed: gone.length, failed };
}

export async function upsertSubscription(
  db: Db,
  sub: { endpoint: string; keys: { p256dh: string; auth: string } },
) {
  await db
    .insert(pushSubscriptions)
    .values({ endpoint: sub.endpoint, keys: sub.keys, userId: null })
    .onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: { keys: sub.keys } });
}

export async function removeSubscription(db: Db, endpoint: string) {
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
}
