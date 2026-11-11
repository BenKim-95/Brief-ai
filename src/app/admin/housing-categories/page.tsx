"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { parseKeywords } from "@/lib/housing/classify";
import { useAdminApi } from "../admin-api";

type Category = { id: number; name: string; description: string; keywords: string[] };
type Label = {
  feedName: string | null;
  typeLabel: string;
  categoryId: number | null;
  count: number;
};

const EMPTY = { name: "", description: "", keywords: "" };

export default function HousingCategoriesPage() {
  const { token, call } = useAdminApi();
  const [items, setItems] = useState<Category[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await call<{ categories: Category[]; labels: Label[] }>(
        "/api/housing/categories",
      );
      setItems(data.categories);
      setLabels(data.labels);
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
    const body = {
      name: form.name,
      description: form.description,
      keywords: parseKeywords(form.keywords),
    };
    void run(async () => {
      if (editing === null) {
        await call("/api/housing/categories", { method: "POST", body });
      } else {
        await call(`/api/housing/categories/${editing}`, { method: "PATCH", body });
      }
      setForm(EMPTY);
      setEditing(null);
    });
  }

  function move(index: number, delta: -1 | 1) {
    const next = [...items];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    void run(() =>
      call("/api/housing/categories/reorder", {
        method: "PUT",
        body: { ids: next.map((c) => c.id) },
      }),
    );
  }

  const nameOf = (id: number | null) =>
    items.find((c) => c.id === id)?.name ?? "미분류";

  return (
    <section>
      <h2 className="mb-1 text-lg font-semibold">청약 카테고리</h2>
      <p className="mb-3 text-sm">
        공고의 &ldquo;API 이름 + 주택 유형&rdquo;에 키워드가 들어 있으면 그
        카테고리로 분류해요. 위에 있는 카테고리부터 먼저 맞춰 보고, 바꾸면 저장된
        공고도 바로 다시 분류해요.
      </p>
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
          placeholder="키워드 (쉼표로 구분, 예: 무순위, 잔여세대)"
          value={form.keywords}
          onChange={(e) => setForm({ ...form, keywords: e.target.value })}
          className="min-h-11 rounded border px-3 text-base"
        />
        <textarea
          placeholder="설명 (선택)"
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
                setForm(EMPTY);
              }}
            >
              취소
            </Button>
          )}
        </div>
      </form>

      <ul className="mb-8 grid gap-3">
        {items.map((c, i) => (
          <li key={c.id} className="rounded border p-3">
            <p className="font-medium">
              {i + 1}. {c.name}
            </p>
            <p className="text-sm">
              키워드: {c.keywords.length ? c.keywords.join(", ") : "(없음 · 자동 분류 안 함)"}
            </p>
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
                  setForm({
                    name: c.name,
                    description: c.description,
                    keywords: c.keywords.join(", "),
                  });
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
                      call(`/api/housing/categories/${c.id}`, { method: "DELETE" }),
                    );
                }}
              >
                삭제
              </Button>
            </div>
          </li>
        ))}
        {items.length === 0 && token && !error && <li>등록된 카테고리가 없어요.</li>}
      </ul>

      <h3 className="mb-2 font-semibold">받아 둔 공고의 유형</h3>
      <p className="mb-2 text-sm">키워드를 정할 때 참고해 주세요.</p>
      <ul className="grid gap-1 text-sm">
        {labels.map((l) => (
          <li key={`${l.feedName}|${l.typeLabel}|${l.categoryId}`}>
            {[l.feedName ?? "(삭제된 API)", l.typeLabel].filter(Boolean).join(" · ")}{" "}
            — {l.count}건 → {nameOf(l.categoryId)}
          </li>
        ))}
        {labels.length === 0 && token && !error && (
          <li>아직 받아 둔 공고가 없어요. 청약 화면에서 가져와 주세요.</li>
        )}
      </ul>
    </section>
  );
}
