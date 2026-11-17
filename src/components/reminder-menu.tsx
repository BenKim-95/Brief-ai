"use client";

import { useState } from "react";
import { PRESET_LABELS, REMIND_PRESETS } from "@/lib/news/reminder";

/**
 * "나중에 읽기" 캘린더 추가. 시간을 고르면 .ics 파일을 내려받는다(열면 캘린더 앱에 일정과 알림이 추가된다).
 * 서버가 알려 주는 오류(지난 날짜 등)는 화면에 문장으로 보여 준다.
 */
export function ReminderMenu({ articleId }: { articleId: number }) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function download(query: string) {
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch(`/api/articles/${articleId}/ics?${query}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "캘린더 파일을 만들지 못했어요.");
      }
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = `article-${articleId}.ics`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setMessage("캘린더 파일을 내려받았어요. 열면 일정이 추가돼요.");
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const btn = "inline-flex min-h-11 items-center rounded-full border border-line px-4 text-sm disabled:opacity-50";

  return (
    <div className="inline-flex flex-col">
      <button type="button" className={btn} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        읽을 시간 알림
      </button>
      {open && (
        <div className="mt-2 flex flex-col gap-2 rounded-2xl border border-line bg-background p-3">
          {REMIND_PRESETS.map((p) => (
            <button key={p} type="button" className={btn} disabled={busy} onClick={() => void download(`when=${p}`)}>
              {PRESET_LABELS[p]}
            </button>
          ))}
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (date) void download(`date=${date}`);
            }}
          >
            <input
              type="date"
              required
              aria-label="읽을 날짜"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="min-h-11 min-w-0 flex-1 rounded-full border border-line bg-background px-3 text-sm"
            />
            <button type="submit" className={btn} disabled={busy}>
              그날 오전 9시
            </button>
          </form>
        </div>
      )}
      {message && (
        <p role="status" className="mt-2 max-w-[260px] text-xs text-sub">
          {message}
        </p>
      )}
    </div>
  );
}
