"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export const ADMIN_TOKEN_KEY = "admin-token";
/** 토큰을 입력하거나 지울 때 같은 화면의 다른 부분(관리자 전용 버튼 등)에 알리는 이벤트 */
export const ADMIN_TOKEN_EVENT = "admin-token-change";
const STORAGE_KEY = ADMIN_TOKEN_KEY;

type Api = {
  token: string;
  setToken: (t: string) => void;
  /** Fetch an admin API; throws Error(message) on non-2xx. */
  call: <T = unknown>(
    path: string,
    init?: { method?: string; body?: unknown },
  ) => Promise<T>;
};

const Ctx = createContext<Api | null>(null);

export function AdminApiProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- storage is client-only
      setTokenState(localStorage.getItem(STORAGE_KEY) ?? sessionStorage.getItem(STORAGE_KEY) ?? "");
    } catch {}
    setReady(true);
  }, []);

  const setToken = useCallback((t: string) => {
    setTokenState(t);
    if (!t) {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {}
    }
    try {
      localStorage.setItem(STORAGE_KEY, t);
    } catch {}
    window.dispatchEvent(new Event(ADMIN_TOKEN_EVENT));
  }, []);

  const call = useCallback<Api["call"]>(
    async (path, init) => {
      const res = await fetch(path, {
        method: init?.method ?? "GET",
        headers: {
          "x-admin-token": token,
          ...(init?.body !== undefined
            ? { "Content-Type": "application/json" }
            : {}),
        },
        body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
      });
      if (res.status === 204) return undefined as never;
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        // Wrong/stale token: forget it so the input field shows again.
        setToken("");
        try {
          sessionStorage.removeItem(STORAGE_KEY);
        } catch {}
        throw new Error("토큰이 맞지 않아요. 다시 입력해 주세요.");
      }
      if (!res.ok) throw new Error(data.error ?? `요청에 실패했어요 (${res.status})`);
      return data;
    },
    [token, setToken],
  );

  const value = useMemo(() => ({ token, setToken, call }), [token, setToken, call]);
  if (!ready) return null;
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAdminApi() {
  const v = useContext(Ctx);
  if (!v) throw new Error("AdminApiProvider가 필요해요.");
  return v;
}
