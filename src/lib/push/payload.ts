import { z } from "zod";

/** 알림에 담는 내용. 서비스 워커(public/sw.js)가 같은 모양으로 읽는다. */
export const pushPayloadSchema = z.object({
  title: z.string().min(1).max(80),
  body: z.string().max(200).default(""),
  /** 눌렀을 때 열 사이트 안 경로. 바깥 주소는 허용하지 않는다. */
  url: z
    .string()
    .regex(/^\/(?!\/)/, "사이트 안 경로여야 해요")
    .default("/"),
});
export type PushPayload = z.infer<typeof pushPayloadSchema>;

/** 구독 정보(브라우저 PushSubscription.toJSON() 결과). 푸시 서비스 주소는 https만 받는다. */
/** 서버가 이 주소로 요청을 보내므로, https 이고 내부망·IP 직접 주소가 아닌 것만 받는다. */
export function isSafePushEndpoint(value: string): boolean {
  let u: URL;
  try {
    u = new URL(value);
  } catch {
    return false;
  }
  if (u.protocol !== "https:" || u.username || u.password) return false;
  const host = u.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    return false;
  }
  if (/^[\d.]+$/.test(host) || host.includes(":")) return false; // IPv4/IPv6 주소 직접 지정
  return host.includes(".");
}

export const subscriptionSchema = z.object({
  endpoint: z.url().refine(isSafePushEndpoint, "푸시 서비스의 https 주소여야 해요"),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});
export type PushSubscriptionInput = z.infer<typeof subscriptionSchema>;

export const unsubscribeSchema = z.object({
  endpoint: z.url(),
});
