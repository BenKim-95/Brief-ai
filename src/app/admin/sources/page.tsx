"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { useAdminApi } from "../admin-api";

type Source = {
  id: number;
  name: string;
  url: string;
  language: string;
  active: boolean;
};

export default function SourcesPage() {
  const { token, call } = useAdminApi();
  const [items, setItems] = useState<Source[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: "", url: "", language: "en" });
  const [editing, setEditing] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      setItems(await call<Source[]>("/api/sources"));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, [call]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount/token change
    if (token) void load();
  }, [token, load]);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await fn();
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    void run(async () => {
      if (editing === null) {
        await call("/api/sources", { method: "POST", body: form });
      } else {
        await call(`/api/sources/${editing}`, { method: "PATCH", body: form });
      }
      setForm({ name: "", url: "", language: "en" });
      setEditing(null);
    });
  }

  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">RSS 소스</h2>
      {error && (
        <p role="alert" className="mb-3 text-red-700">
          ⚠ {error}
        </p>
      )}

      <form onSubmit={submit} className="mb-6 grid gap-2">
        <input
          required
          placeholder="이름"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="min-h-11 rounded border px-3 text-base"
        />
        <input
          required
          type="url"
          placeholder="RSS 주소 (https://...)"
          value={form.url}
          onChange={(e) => setForm({ ...form, url: e.target.value })}
          className="min-h-11 rounded border px-3 text-base"
        />
        <input
          required
          placeholder="언어 (ko, en ...)"
          value={form.language}
          onChange={(e) => setForm({ ...form, language: e.target.value })}
          className="min-h-11 rounded border px-3 text-base"
        />
        <div className="flex gap-2">
          <Button type="submit" disabled={busy || !token} className="min-h-11">
            {editing === null ? "추가" : "저장"}
          </Button>
          {editing !== null && (
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => {
                setEditing(null);
                setForm({ name: "", url: "", language: "en" });
              }}
            >
              취소
            </Button>
          )}
        </div>
        <p className="text-sm">추가·수정할 때 RSS를 읽을 수 있는지 확인해요.</p>
      </form>

      <ul className="grid gap-3">
        {items.map((s) => (
          <li key={s.id} className="rounded border p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium">
                  {s.name} <span className="text-sm">({s.language})</span>
                </p>
                <p className="break-all text-sm">{s.url}</p>
              </div>
              <span className="shrink-0 text-sm">
                {s.active ? "● 사용 중" : "○ 꺼짐"}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button
                variant="outline"
                className="min-h-11"
                disabled={busy}
                onClick={() =>
                  run(() =>
                    call(`/api/sources/${s.id}`, {
                      method: "PATCH",
                      body: { active: !s.active },
                    }),
                  )
                }
              >
                {s.active ? "끄기" : "켜기"}
              </Button>
              <Button
                variant="outline"
                className="min-h-11"
                onClick={() => {
                  setEditing(s.id);
                  setForm({ name: s.name, url: s.url, language: s.language });
                }}
              >
                수정
              </Button>
              <Button
                variant="outline"
                className="min-h-11"
                disabled={busy}
                onClick={() => {
                  if (confirm(`"${s.name}" 소스를 삭제할까요?`))
                    void run(() =>
                      call(`/api/sources/${s.id}`, { method: "DELETE" }),
                    );
                }}
              >
                삭제
              </Button>
            </div>
          </li>
        ))}
        {items.length === 0 && token && !error && <li>등록된 소스가 없어요.</li>}
      </ul>
    </section>
  );
}
