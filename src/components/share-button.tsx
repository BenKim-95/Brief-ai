"use client";

import { useEffect, useRef, useState } from "react";

/** 공유할 때 같이 보내는 문장은 너무 길지 않게 자른다. */
export function clip(text: string, max = 100): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`;
}

/** "/articles/3" 같은 사이트 안 경로만 받아 이 사이트의 전체 주소로 바꾼다. 그 밖의 값은 null. */
export function toShareUrl(path: string, origin: string): string | null {
  if (!path.startsWith("/") || path.startsWith("//")) return null;
  return `${origin}${path}`;
}

/**
 * 공유 버튼. 휴대폰·앱에서는 기기의 공유 창(카카오톡·문자 등)을 열고,
 * 공유 창이 없는 브라우저에서는 링크를 복사한다. 복사도 안 되면 링크를 보여 줘서 직접 복사하게 한다.
 * 공유하는 것은 이 사이트의 기사 페이지 주소와 우리가 만든 한 줄 안내뿐이다(기사 본문은 보내지 않는다).
 */
export function ShareButton({
  path,
  title,
  text,
  label = "공유",
}: {
  /** 이 사이트 안 경로. 예: /articles/3 */
  path: string;
  title: string;
  text?: string;
  label?: string;
}) {
  const [message, setMessage] = useState("");
  const [manualUrl, setManualUrl] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  function say(m: string) {
    setMessage(m);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(""), 3000);
  }

  async function share() {
    const url = toShareUrl(path, window.location.origin);
    if (!url) return;
    setManualUrl("");
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, text: text ? clip(text) : undefined, url });
        return;
      } catch (e) {
        // 공유 창을 그냥 닫은 건 오류가 아니다.
        if ((e as DOMException)?.name === "AbortError") return;
        // 그 밖의 실패는 아래 복사로 넘어간다.
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      say("링크를 복사했어요.");
    } catch {
      setManualUrl(url);
    }
  }

  return (
    <div className="inline-flex flex-col">
      <button
        type="button"
        onClick={() => void share()}
        className="inline-flex min-h-11 items-center rounded-full border border-line px-4 text-sm"
      >
        {label}
      </button>
      {/* 복사했다는 안내를 화면에 보이고, 스크린리더에도 읽히게 한다(role=status는 카드 안 다른 안내와 겹치지 않게 쓰지 않는다). */}
      <p aria-live="polite" className={message ? "mt-1 text-xs text-ink" : "sr-only"}>
        {message}
      </p>
      {manualUrl && (
        <input
          readOnly
          aria-label="공유할 링크 (길게 눌러 복사)"
          value={manualUrl}
          onFocus={(e) => e.currentTarget.select()}
          className="mt-1 min-h-11 w-56 rounded-xl border border-line bg-background px-3 text-xs"
        />
      )}
    </div>
  );
}
