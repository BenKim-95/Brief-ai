import { describe, expect, it, vi } from "vitest";
import { readVapid } from "./config";
import { isSafePushEndpoint, pushPayloadSchema, subscriptionSchema } from "./payload";
import { isGone, sendToAll } from "./send";

describe("readVapid", () => {
  const ok = { NEXT_PUBLIC_VAPID_PUBLIC_KEY: "pub", VAPID_PRIVATE_KEY: "priv", VAPID_SUBJECT: "mailto:a@b.co" };
  it("세 값이 모두 있으면 읽는다", () => {
    expect(readVapid(ok as unknown as NodeJS.ProcessEnv)).toEqual({
      publicKey: "pub",
      privateKey: "priv",
      subject: "mailto:a@b.co",
    });
  });
  it("하나라도 없거나 subject 형식이 틀리면 null", () => {
    expect(readVapid({ ...ok, VAPID_PRIVATE_KEY: "" } as unknown as NodeJS.ProcessEnv)).toBeNull();
    expect(readVapid({ ...ok, VAPID_SUBJECT: "a@b.co" } as unknown as NodeJS.ProcessEnv)).toBeNull();
    expect(readVapid({} as NodeJS.ProcessEnv)).toBeNull();
  });
});

describe("isSafePushEndpoint", () => {
  it("푸시 서비스의 https 주소만 허용", () => {
    expect(isSafePushEndpoint("https://fcm.googleapis.com/fcm/send/abc")).toBe(true);
    expect(isSafePushEndpoint("https://web.push.apple.com/xyz")).toBe(true);
  });
  it("http, 내부망, IP 직접 주소, 계정 정보 포함은 거부", () => {
    for (const u of [
      "http://fcm.googleapis.com/x",
      "https://localhost/x",
      "https://127.0.0.1/x",
      "https://[::1]/x",
      "https://10.0.0.5/x",
      "https://printer.local/x",
      "https://user:pw@fcm.googleapis.com/x",
      "not a url",
    ]) {
      expect(isSafePushEndpoint(u), u).toBe(false);
    }
  });
});

describe("schemas", () => {
  it("알림 url은 사이트 안 경로만", () => {
    expect(pushPayloadSchema.parse({ title: "t" }).url).toBe("/");
    expect(pushPayloadSchema.safeParse({ title: "t", url: "https://evil.example" }).success).toBe(false);
    expect(pushPayloadSchema.safeParse({ title: "t", url: "//evil.example" }).success).toBe(false);
    expect(pushPayloadSchema.safeParse({ title: "", url: "/" }).success).toBe(false);
  });
  it("구독 형식 검증", () => {
    const good = { endpoint: "https://fcm.googleapis.com/fcm/send/abc", keys: { p256dh: "a", auth: "b" } };
    expect(subscriptionSchema.safeParse(good).success).toBe(true);
    expect(subscriptionSchema.safeParse({ ...good, keys: { p256dh: "a" } }).success).toBe(false);
  });
});

describe("sendToAll", () => {
  const vapid = { subject: "mailto:a@b.co", publicKey: "pub", privateKey: "priv" };
  const payload = { title: "t", body: "b", url: "/" };

  function fakeDb(rows: { id: number; endpoint: string; keys: { p256dh: string; auth: string } }[]) {
    const deleted: number[][] = [];
    const db = {
      select: () => ({ from: async () => rows }),
      delete: () => ({
        where: async () => {
          deleted.push([]);
        },
      }),
    };
    return { db: db as never, deleted };
  }

  it("410/404는 지우고 다른 실패는 센다", async () => {
    const rows = [1, 2, 3, 4].map((id) => ({ id, endpoint: `https://p.example.com/${id}`, keys: { p256dh: "a", auth: "b" } }));
    const { db, deleted } = fakeDb(rows);
    const send = vi.fn(async (sub: { endpoint: string }) => {
      if (sub.endpoint.endsWith("/2")) throw Object.assign(new Error("gone"), { statusCode: 410 });
      if (sub.endpoint.endsWith("/3")) throw Object.assign(new Error("nf"), { statusCode: 404 });
      if (sub.endpoint.endsWith("/4")) throw Object.assign(new Error("boom"), { statusCode: 500 });
    });
    const result = await sendToAll(db, vapid, payload, send);
    expect(result).toEqual({ sent: 1, removed: 2, failed: 1 });
    expect(deleted).toHaveLength(1);
    expect(send).toHaveBeenCalledTimes(4);
    expect((send.mock.calls[0] as unknown[])[1]).toBe(JSON.stringify(payload));
  });

  it("구독이 없으면 아무것도 지우지 않는다", async () => {
    const { db, deleted } = fakeDb([]);
    const result = await sendToAll(db, vapid, payload, vi.fn());
    expect(result).toEqual({ sent: 0, removed: 0, failed: 0 });
    expect(deleted).toHaveLength(0);
  });

  it("isGone", () => {
    expect(isGone({ statusCode: 410 })).toBe(true);
    expect(isGone({ statusCode: 500 })).toBe(false);
    expect(isGone(null)).toBe(false);
  });
});
