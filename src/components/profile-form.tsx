"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useBusy } from "./busy-overlay";
import { MAX_INTERESTS, NICKNAME_MAX } from "@/lib/my/constants";

/** 마이페이지의 닉네임·관심 카테고리 편집. */
export function ProfileForm({
  initialNickname,
  initialInterestIds,
  categories,
  placeholderName,
}: {
  initialNickname: string;
  initialInterestIds: number[];
  categories: { id: number; name: string }[];
  /** 닉네임을 비웠을 때 쓰일 이름 */
  placeholderName: string;
}) {
  const router = useRouter();
  const [nickname, setNickname] = useState(initialNickname);
  const [ids, setIds] = useState<number[]>(initialInterestIds);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [pending, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);
  useBusy(saving || pending, "저장하는 중이에요…");

  function toggle(id: number) {
    setMessage("");
    setIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : cur.length >= MAX_INTERESTS ? cur : [...cur, id]));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/my/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nickname, interestCategoryIds: ids }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const first = Array.isArray(data.details) ? data.details[0]?.message : undefined;
        throw new Error(first ?? data.error ?? `저장하지 못했어요 (${res.status})`);
      }
      setIsError(false);
      setMessage("저장했어요.");
      startTransition(() => router.refresh());
    } catch (err) {
      setIsError(true);
      setMessage((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-5">
      <div>
        <label htmlFor="nickname" className="mb-1 block text-sm font-bold">
          닉네임
        </label>
        <input
          id="nickname"
          value={nickname}
          maxLength={NICKNAME_MAX}
          onChange={(e) => {
            setNickname(e.target.value);
            setMessage("");
          }}
          placeholder={placeholderName}
          className="min-h-11 w-full rounded-xl border border-line bg-background px-3 text-[15px]"
        />
        <p className="mt-1 text-xs text-sub">제보 기사의 글과 댓글에 보여요. 비우면 &quot;{placeholderName}&quot;으로 나와요.</p>
      </div>

      <fieldset>
        <legend className="mb-1 text-sm font-bold">관심 카테고리</legend>
        <p className="mb-2 text-xs text-sub">고르면 &quot;나와 관련된 소식&quot;에 이 카테고리의 소식을 먼저 보여 드려요.</p>
        {categories.length === 0 ? (
          <p className="text-sm text-sub">아직 고를 수 있는 카테고리가 없어요.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => {
              const on = ids.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(c.id)}
                  className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm ${
                    on ? "border-ink bg-ink text-app" : "border-line bg-surface text-ink"
                  }`}
                >
                  {on ? "✓ " : ""}
                  {c.name}
                </button>
              );
            })}
          </div>
        )}
      </fieldset>

      <div>
        <button
          type="submit"
          disabled={saving}
          className="flex min-h-12 w-full items-center justify-center rounded-full bg-brand px-5 text-base font-bold text-primary-foreground disabled:opacity-60"
        >
          저장하기
        </button>
        <p role={isError ? "alert" : "status"} className={`mt-2 min-h-5 text-sm ${isError ? "text-no" : "text-ink"}`}>
          {message}
        </p>
      </div>
    </form>
  );
}
