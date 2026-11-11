"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { useAdminApi } from "../admin-api";

type Feed = { id: number; name: string; endpoint: string; active: boolean };

const EMPTY = { name: "", endpoint: "" };

export default function HousingFeedsPage() {
  const { token, call } = useAdminApi();
  const [items, setItems] = useState<Feed[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      setItems(await call<Feed[]>("/api/housing/feeds"));
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
        await call("/api/housing/feeds", { method: "POST", body: form });
      } else {
        await call(`/api/housing/feeds/${editing}`, { method: "PATCH", body: form });
      }
      setForm(EMPTY);
      setEditing(null);
    });
  }

  return (
    <section>
      <h2 className="mb-1 text-lg font-semibold">청약 API</h2>
      <p className="mb-3 text-sm">
        청약홈 분양정보 조회 서비스의 오퍼레이션 이름을 등록해요. 추가할 때 실제로
        한 번 호출해서 확인해요.
      </p>
      {error && (
        <p role="alert" className="mb-3 text-red-700">
          ⚠ {error}
        </p>
      )}

      <form onSubmit={submit} className="mb-6 grid gap-2">
        <input
          required
          placeholder="이름 (예: APT 분양)"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="min-h-11 rounded border px-3 text-base"
        />
        <input
          required
          placeholder="오퍼레이션 (예: getAPTLttotPblancDetail)"
          value={form.endpoint}
          onChange={(e) => setForm({ ...form, endpoint: e.target.value })}
          className="min-h-11 rounded border px-3 font-mono text-base"
          autoCapitalize="off"
          spellCheck={false}
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

      <ul className="grid gap-3">
        {items.map((f) => (
          <li key={f.id} className="rounded border p-3">
            <p className="font-medium">
              {f.name} {f.active ? "" : "(꺼짐)"}
            </p>
            <p className="break-all font-mono text-sm">{f.endpoint}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button
                variant="outline"
                className="min-h-11"
                disabled={busy}
                onClick={() =>
                  void run(() =>
                    call(`/api/housing/feeds/${f.id}`, {
                      method: "PATCH",
                      body: { active: !f.active },
                    }),
                  )
                }
              >
                {f.active ? "끄기" : "켜기"}
              </Button>
              <Button
                variant="outline"
                className="min-h-11"
                onClick={() => {
                  setEditing(f.id);
                  setForm({ name: f.name, endpoint: f.endpoint });
                }}
              >
                수정
              </Button>
              <Button
                variant="outline"
                className="min-h-11"
                disabled={busy}
                onClick={() => {
                  if (confirm(`"${f.name}"을(를) 삭제할까요? 받아 둔 공고는 남아요.`))
                    void run(() => call(`/api/housing/feeds/${f.id}`, { method: "DELETE" }));
                }}
              >
                삭제
              </Button>
            </div>
          </li>
        ))}
        {items.length === 0 && token && !error && <li>등록된 청약 API가 없어요.</li>}
      </ul>
    </section>
  );
}
