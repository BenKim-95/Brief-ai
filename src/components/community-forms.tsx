"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ADMIN_TOKEN_KEY } from "@/app/admin/admin-api";
import { AdminOnly } from "./admin-only";
import { useBusy } from "./busy-overlay";
import { COMMENT_MAX, POST_BODY_MAX, TITLE_MAX } from "@/lib/community/rules";

const field = "w-full rounded-xl border border-line bg-background px-3 text-[15px]";
const primary =
  "flex min-h-12 w-full items-center justify-center rounded-full bg-brand px-5 text-base font-bold text-primary-foreground disabled:opacity-60";

/** 서버가 돌려준 오류 문장(입력 검증은 첫 항목의 이유)을 꺼낸다. */
async function errorOf(res: Response): Promise<string> {
  const data = await res.json().catch(() => ({}));
  const first = Array.isArray(data.details) ? data.details[0]?.message : undefined;
  return first ?? data.error ?? `요청에 실패했어요 (${res.status})`;
}

/** 글쓰기. 성공하면 방금 쓴 글로 이동한다. */
export function NewPostForm({ articleId, articleTitle }: { articleId?: number; articleTitle?: string }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useBusy(busy, "글을 올리는 중이에요…");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/community/posts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, body, ...(articleId ? { articleId } : {}) }),
      });
      if (!res.ok) throw new Error(await errorOf(res));
      const { id } = (await res.json()) as { id: number };
      router.push(`/community/${id}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {articleTitle && (
        <p className="rounded-2xl bg-surface p-4 text-sm text-sub">
          이 소식에 대한 이야기예요: <b className="text-ink">{articleTitle}</b>
        </p>
      )}
      <div>
        <label htmlFor="post-title" className="mb-1 block text-sm font-bold">
          제목
        </label>
        <input
          id="post-title"
          value={title}
          maxLength={TITLE_MAX}
          onChange={(e) => setTitle(e.target.value)}
          className={`${field} min-h-11`}
          autoComplete="off"
        />
      </div>
      <div>
        <label htmlFor="post-body" className="mb-1 block text-sm font-bold">
          내용
        </label>
        <textarea
          id="post-body"
          value={body}
          maxLength={POST_BODY_MAX}
          onChange={(e) => setBody(e.target.value)}
          rows={8}
          className={`${field} py-2 leading-[1.6]`}
        />
        <p className="mt-1 text-right text-xs text-sub">
          {body.length} / {POST_BODY_MAX}
        </p>
      </div>
      <button type="submit" disabled={busy} className={primary}>
        글 올리기
      </button>
      <p role="alert" className="min-h-5 text-sm text-no">
        {error}
      </p>
    </form>
  );
}

/** 댓글쓰기. 성공하면 목록을 새로 불러온다. */
export function CommentForm({ postId }: { postId: number }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, startTransition] = useTransition();
  useBusy(busy || pending, "댓글을 올리는 중이에요…");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/community/posts/${postId}/comments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body }),
      });
      if (!res.ok) throw new Error(await errorOf(res));
      setBody("");
      startTransition(() => router.refresh());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <label htmlFor="comment-body" className="text-sm font-bold">
        댓글 쓰기
      </label>
      <textarea
        id="comment-body"
        value={body}
        maxLength={COMMENT_MAX}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        className={`${field} py-2 leading-[1.6]`}
      />
      <button type="submit" disabled={busy} className={primary}>
        댓글 올리기
      </button>
      <p role="alert" className="min-h-5 text-sm text-no">
        {error}
      </p>
    </form>
  );
}

function adminToken(): string {
  try {
    return localStorage.getItem(ADMIN_TOKEN_KEY) ?? "";
  } catch {
    return "";
  }
}

/**
 * 글·댓글 아래의 작은 버튼들: 내 글이면 "지우기", 남의 글이면 "신고", 관리자에게는 "관리자 삭제"도 보인다.
 * `afterDelete`가 있으면 지운 뒤 그 주소로 이동하고, 없으면 화면만 새로 불러온다.
 */
export function ItemActions({
  kind,
  id,
  mine,
  afterDelete,
}: {
  kind: "post" | "comment";
  id: number;
  mine: boolean;
  afterDelete?: string;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();
  useBusy(busy, "처리 중이에요…");
  const base = kind === "post" ? "/api/community/posts" : "/api/community/comments";
  const noun = kind === "post" ? "글" : "댓글";

  async function remove(asAdmin: boolean) {
    if (!window.confirm(`이 ${noun}을 지울까요? 지우면 되돌릴 수 없어요.`)) return;
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch(`${base}/${id}`, {
        method: "DELETE",
        headers: asAdmin ? { "x-admin-token": adminToken() } : undefined,
      });
      if (!res.ok) throw new Error(await errorOf(res));
      if (afterDelete) router.push(afterDelete);
      else startTransition(() => router.refresh());
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function report() {
    if (!window.confirm(`이 ${noun}을 신고할까요? 여러 명이 신고하면 자동으로 가려져요.`)) return;
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch("/api/community/report", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind, id }),
      });
      if (!res.ok) throw new Error(await errorOf(res));
      setMessage("신고했어요. 확인할게요.");
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const small = "inline-flex min-h-9 items-center rounded-full border border-line px-3 text-xs text-sub disabled:opacity-50";
  return (
    <div className="flex flex-wrap items-center gap-2">
      {mine ? (
        <button type="button" className={small} disabled={busy} onClick={() => void remove(false)}>
          지우기
        </button>
      ) : (
        <button type="button" className={small} disabled={busy} onClick={() => void report()}>
          신고
        </button>
      )}
      <AdminOnly>
        {!mine && (
          <button type="button" className={small} disabled={busy} onClick={() => void remove(true)}>
            관리자 삭제
          </button>
        )}
      </AdminOnly>
      <span role="status" className="text-xs text-sub">
        {message}
      </span>
    </div>
  );
}
