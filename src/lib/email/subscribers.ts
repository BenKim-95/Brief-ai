import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import type { getDb } from "@/db";
import { emailSubscribers } from "@/db/schema";

type Db = ReturnType<typeof getDb>;

/** 개인용 앱이라 받는 주소 수에 상한을 둔다(실수나 남용으로 대량 발송되는 것을 막는다). */
export const MAX_EMAIL_SUBSCRIBERS = 20;

export const normalizeEmail = (email: string) => email.trim().toLowerCase();
export const newToken = () => randomBytes(24).toString("base64url");

export type AddResult = "added" | "exists" | "limit";

export async function addSubscriber(db: Db, email: string): Promise<AddResult> {
  const rows = await db.select({ id: emailSubscribers.id, email: emailSubscribers.email }).from(emailSubscribers);
  const e = normalizeEmail(email);
  if (rows.some((r) => r.email === e)) return "exists";
  if (rows.length >= MAX_EMAIL_SUBSCRIBERS) return "limit";
  const inserted = await db
    .insert(emailSubscribers)
    .values({ email: e, unsubscribeToken: newToken(), userId: null })
    .onConflictDoNothing()
    .returning({ id: emailSubscribers.id });
  return inserted.length > 0 ? "added" : "exists";
}

export async function listSubscribers(db: Db) {
  return db.select().from(emailSubscribers).orderBy(emailSubscribers.id);
}

export async function removeSubscriberById(db: Db, id: number) {
  await db.delete(emailSubscribers).where(eq(emailSubscribers.id, id));
}

/** 수신 해제 링크의 토큰으로 지운다. 지워졌으면 true. */
export async function removeSubscriberByToken(db: Db, token: string): Promise<boolean> {
  const rows = await db
    .delete(emailSubscribers)
    .where(eq(emailSubscribers.unsubscribeToken, token))
    .returning({ id: emailSubscribers.id });
  return rows.length > 0;
}

export function unsubscribeLink(siteUrl: string, token: string) {
  return `${siteUrl}/email/unsubscribe?token=${encodeURIComponent(token)}`;
}
