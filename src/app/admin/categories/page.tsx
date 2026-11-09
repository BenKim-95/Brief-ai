"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { useAdminApi } from "../admin-api";

type Category = { id: number; name: string; description: string };

export default function CategoriesPage() {
  const { token, call } = useAdminApi();
  const [items, setItems] = useState<Category[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: "", description: "" });
  const [editing, setEditing] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      setItems(await call<Category[]>("/api/categories"));
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
        await call("/api/categories", { method: "POST", body: form });
      } else {
        await call(`/api/categories/${editing}`, {
          method: "PATCH",
          body: form,
        });
      }
      setForm({ name: "", description: "" });
      setEditing(null);
    });
  }

  function move(index: number, delta: -1 | 1) {
    const next = [...items];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    void run(() =>
      call("/api/categories/reorder", {
        method: "PUT",
        body: { ids: next.map((c) => c.id) },
      }),
    );
  }

  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">카테고리</h2>
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
        <textarea
          placeholder="설명 (AI가 분류할 때 참고해요)"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          rows={2}
          className="rounded border px-3 py-2 text-base"
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
                setForm({ name: "", description: "" });
              }}
            >
              취소
            </Button>
          )}
        </div>
      </form>

      <ul className="grid gap-3">
        {items.map((c, i) => (
          <li key={c.id} className="rounded border p-3">
            <p className="font-medium">{c.name}</p>
            {c.description && <p className="text-sm">{c.description}</p>}
            <div className="mt-2 flex flex-wrap gap-2">
              <Button
                variant="outline"
                className="min-h-11"
                aria-label={`${c.name} 위로`}
                disabled={busy || i === 0}
                onClick={() => move(i, -1)}
              >
                ↑ 위로
              </Button>
              <Button
                variant="outline"
                className="min-h-11"
                aria-label={`${c.name} 아래로`}
                disabled={busy || i === items.length - 1}
                onClick={() => move(i, 1)}
              >
                ↓ 아래로
              </Button>
              <Button
                variant="outline"
                className="min-h-11"
                onClick={() => {
                  setEditing(c.id);
                  setForm({ name: c.name, description: c.description });
                }}
              >
                수정
              </Button>
              <Button
                variant="outline"
                className="min-h-11"
                disabled={busy}
                onClick={() => {
                  if (confirm(`"${c.name}" 카테고리를 삭제할까요?`))
                    void run(() =>
                      call(`/api/categories/${c.id}`, { method: "DELETE" }),
                    );
                }}
              >
                삭제
              </Button>
            </div>
          </li>
        ))}
        {items.length === 0 && token && !error && (
          <li>등록된 카테고리가 없어요.</li>
        )}
      </ul>
    </section>
  );
}
