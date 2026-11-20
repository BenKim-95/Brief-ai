"use client";

import { useEffect, useState } from "react";
import { useBusy } from "./busy-overlay";
import { ADMIN_TOKEN_KEY } from "@/app/admin/admin-api";

type Status = "loading" | "unsupported" | "denied" | "off" | "on";

function readToken(): string {
  try {
    return localStorage.getItem(ADMIN_TOKEN_KEY) ?? sessionStorage.getItem(ADMIN_TOKEN_KEY) ?? "";
  } catch {
    return "";
  }
}

function urlBase64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function callApi(method: string, path: string, body?: unknown) {
  const token = readToken();
  if (!token) throw new Error("관리 토큰이 필요해요. 관리 화면(/admin/sources)에서 먼저 입력해 주세요.");
  const res = await fetch(path, {
    method,
    headers: { "x-admin-token": token, ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) throw new Error("토큰이 맞지 않아요. 다시 입력해 주세요.");
  if (!res.ok) throw new Error(data.error ?? `요청에 실패했어요 (${res.status})`);
  return data;
}

/** 이 기기의 알림 받기 켜기/끄기와 시험 알림 보내기. */
export function PushToggle() {
  const [status, setStatus] = useState<Status>("loading");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useBusy(busy, "처리 중이에요…");
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        if (alive) setStatus("unsupported");
        return;
      }
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (!alive) return;
      if (Notification.permission === "denied") setStatus("denied");
      else setStatus(sub ? "on" : "off");
    })().catch(() => alive && setStatus("unsupported"));
    return () => {
      alive = false;
    };
  }, []);

  async function turnOn() {
    setBusy(true);
    setMessage("");
    try {
      if (!publicKey) throw new Error("서버에 푸시 키가 설정되지 않았어요.");
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "off");
        throw new Error("알림 권한을 허용해야 받을 수 있어요.");
      }
      const reg = await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToBytes(publicKey) }));
      try {
        await callApi("POST", "/api/push/subscription", sub.toJSON());
      } catch (e) {
        await sub.unsubscribe().catch(() => {}); // 서버에 못 알렸으면 기기에도 남기지 않는다
        throw e;
      }
      setStatus("on");
      setMessage("알림을 켰어요.");
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setBusy(true);
    setMessage("");
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await callApi("DELETE", "/api/push/subscription", { endpoint: sub.endpoint });
        await sub.unsubscribe();
      }
      setStatus("off");
      setMessage("알림을 껐어요.");
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    setBusy(true);
    setMessage("");
    try {
      const r = await callApi("POST", "/api/push/test");
      setMessage(
        r.sent > 0
          ? `시험 알림을 ${r.sent}대에 보냈어요.`
          : "보낼 기기가 없거나 보내지 못했어요. 알림을 다시 켜 주세요.",
      );
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const btn = "inline-flex min-h-11 items-center rounded-full border border-line px-4 text-sm disabled:opacity-50";

  return (
    <section aria-labelledby="push-title" className="rounded-2xl bg-surface p-5">
      <h2 id="push-title" className="mb-1 font-bold">
        이 기기로 알림 받기
      </h2>
      {status === "loading" && <p className="text-sm text-sub">확인하는 중이에요…</p>}
      {status === "unsupported" && (
        <p className="text-sm text-sub">
          이 브라우저에서는 알림을 받을 수 없어요. 아이폰은 홈 화면에 추가한 앱에서만 받을 수 있어요.
        </p>
      )}
      {status === "denied" && (
        <p className="text-sm text-sub">
          알림이 차단되어 있어요. 브라우저 설정에서 이 사이트의 알림을 허용한 뒤 다시 열어 주세요.
        </p>
      )}
      {(status === "off" || status === "on") && (
        <div className="flex flex-wrap items-center gap-2">
          {status === "off" ? (
            <button type="button" className={btn} onClick={turnOn} disabled={busy}>
              알림 켜기
            </button>
          ) : (
            <>
              <button type="button" className={btn} onClick={turnOff} disabled={busy}>
                알림 끄기
              </button>
              <button type="button" className={btn} onClick={sendTest} disabled={busy}>
                시험 알림 보내기
              </button>
            </>
          )}
        </div>
      )}
      {message && (
        <p role="status" className="mt-3 text-sm text-sub">
          {message}
        </p>
      )}
    </section>
  );
}
