"use client";

import { useCallback, useEffect, useState } from "react";
import { ADMIN_TOKEN_KEY } from "@/app/admin/admin-api";

type Item = { id: number; email: string };

function readToken(): string {
  try {
    return localStorage.getItem(ADMIN_TOKEN_KEY) ?? sessionStorage.getItem(ADMIN_TOKEN_KEY) ?? "";
  } catch {
    return "";
  }
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

/** 이메일로 새 소식 요약을 받을 주소 관리. 받는 사람은 메일 속 링크로 직접 해제할 수도 있다. */
export function EmailSubscribe() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await callApi("GET", "/api/email/subscription");
      setItems(data.items);
    } catch (e) {
      setItems([]);
      setMessage((e as Error).message);
    }
  }, []);

  useEffect(() => {
    // 처음 한 번 목록을 불러온다(상태 갱신은 비동기 응답 뒤에 일어난다).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function run(fn: () => Promise<string>) {
    setBusy(true);
    setMessage("");
    try {
      setMessage(await fn());
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const btn = "inline-flex min-h-11 items-center rounded-full border border-line px-4 text-sm disabled:opacity-50";

  return (
    <section aria-labelledby="email-title" className="rounded-2xl bg-surface p-5">
      <h2 id="email-title" className="mb-1 font-bold">
        이메일로 받기
      </h2>
      <p className="mb-3 text-sm text-sub">
        하루 한 번, 새 소식이 있을 때만 보내요. 입력한 주소는 알림 발송에만 쓰고, 메일 속 링크로 언제든 해제할 수 있어요.
      </p>
      <form
        className="mb-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            const r = await callApi("POST", "/api/email/subscription", { email });
            setEmail("");
            await load();
            return r.added ? "주소를 추가했어요." : "이미 등록된 주소예요.";
          });
        }}
      >
        <input
          type="email"
          required
          aria-label="이메일 주소"
          placeholder="name@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="min-h-11 min-w-0 flex-1 rounded-full border border-line bg-background px-4 text-sm"
        />
        <button type="submit" className={btn} disabled={busy}>
          추가
        </button>
      </form>
      {items && items.length > 0 && (
        <>
          <ul className="mb-3 flex flex-col gap-2">
            {items.map((it) => (
              <li key={it.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0 truncate">{it.email}</span>
                <button
                  type="button"
                  className={btn}
                  disabled={busy}
                  aria-label={`${it.email} 삭제`}
                  onClick={() =>
                    void run(async () => {
                      await callApi("DELETE", "/api/email/subscription", { id: it.id });
                      await load();
                      return "주소를 지웠어요.";
                    })
                  }
                >
                  삭제
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className={btn}
            disabled={busy}
            onClick={() =>
              void run(async () => {
                const r = await callApi("POST", "/api/email/test");
                return r.sent > 0 ? `시험 메일을 ${r.sent}곳에 보냈어요.` : "보낼 주소가 없어요.";
              })
            }
          >
            시험 메일 보내기
          </button>
        </>
      )}
      {message && (
        <p role="status" className="mt-3 text-sm text-sub">
          {message}
        </p>
      )}
    </section>
  );
}
