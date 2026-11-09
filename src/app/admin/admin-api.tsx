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

const STORAGE_KEY = "admin-token";

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
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sessionStorage is client-only
      setTokenState(sessionStorage.getItem(STORAGE_KEY) ?? "");
    } catch {}
    setReady(true);
  }, []);

  const setToken = useCallback((t: string) => {
    setTokenState(t);
    try {
      sessionStorage.setItem(STORAGE_KEY, t);
    } catch {}
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
      if (!res.ok) throw new Error(data.error ?? `요청에 실패했어요 (${res.status})`);
      return data;
    },
    [token],
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
