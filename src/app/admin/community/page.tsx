"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdminApi } from "../admin-api";

type Hidden = {
  kind: "post" | "comment";
  id: number;
  authorName: string;
  text: string;
  reports: number;
  createdAt: string;
};

/** 신고가 쌓여 가려진 커뮤니티 글·댓글을 되살리거나 지운다. */
export default function AdminCommunityPage() {
  const { token, call } = useAdminApi();
  const [items, setItems] = useState<Hidden[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems(await call<Hidden[]>("/api/community/admin"));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, [call]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 토큰이 있으면 처음에 한 번 불러온다
    if (token) void load();
  }, [token, load]);

  async function act(it: Hidden, action: "restore" | "delete") {
    if (action === "delete" && !window.confirm("완전히 지울까요? 되돌릴 수 없어요.")) return;
    setBusy(true);
    try {
      await call("/api/community/admin", { method: "POST", body: { kind: it.kind, id: it.id, action } });
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h2 className="mb-2 text-lg font-bold">신고로 가려진 글·댓글</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        서로 다른 사용자 3명이 신고하면 자동으로 가려져요. 문제가 없으면 되살리고, 문제가 있으면 지워 주세요.
      </p>
      {error && (
        <p role="alert" className="mb-3 text-sm text-red-600">
          ⚠ {error}
        </p>
      )}
      {items && items.length === 0 && <p className="text-sm">가려진 글이나 댓글이 없어요.</p>}
      <ul className="grid gap-3">
        {items?.map((it) => (
          <li key={`${it.kind}-${it.id}`} className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">
              {it.kind === "post" ? "글" : "댓글"} #{it.id} · {it.authorName} · 신고 {it.reports}명
            </p>
            <p className="mt-1 whitespace-pre-wrap break-words text-sm">{it.text}</p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void act(it, "restore")}
                className="min-h-11 rounded-md border px-3 text-sm disabled:opacity-50"
              >
                되살리기
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void act(it, "delete")}
                className="min-h-11 rounded-md border px-3 text-sm text-red-600 disabled:opacity-50"
              >
                지우기
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
