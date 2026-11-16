"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

const DISMISS_KEY = "brief-install-dismissed";

function readShouldShowIosHint(): boolean {
  const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const standalone = window.matchMedia("(display-mode: standalone)").matches;
  let dismissed = false;
  try {
    dismissed = localStorage.getItem(DISMISS_KEY) === "1";
  } catch {}
  return isIos && !standalone && !dismissed;
}

const subscribeNothing = () => () => {};

// 서비스 워커 등록 + 홈 화면 설치 안내(아이폰은 공유 버튼으로만 설치할 수 있다).
// 개발 서버에서는 등록하지 않는다(캐시 때문에 수정이 안 보이는 일을 막는다).
export function PwaClient() {
  // 서버 렌더에서는 항상 false → 화면 불일치 없이 브라우저에서만 안내가 나온다.
  const canShow = useSyncExternalStore(subscribeNothing, readShouldShowIosHint, () => false);
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {});
    }
  }, []);

  if (!canShow || closed) return null;
  return (
    <aside
      role="note"
      className="fixed inset-x-0 bottom-0 z-50 mx-auto flex w-full max-w-[560px] items-start gap-3 border-t bg-background p-4 text-sm shadow-lg"
    >
      <p className="flex-1">
        홈 화면에 추가하면 앱처럼 열 수 있어요. 공유 버튼을 누른 뒤 <strong>홈 화면에 추가</strong>를 선택해 주세요.
      </p>
      <button
        type="button"
        className="shrink-0 rounded-md border px-3 py-1"
        onClick={() => {
          try {
            localStorage.setItem(DISMISS_KEY, "1");
          } catch {}
          setClosed(true);
        }}
      >
        닫기
      </button>
    </aside>
  );
}
