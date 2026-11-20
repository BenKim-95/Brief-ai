"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

/** 화면이 안 바뀐 채 이 시간이 지나면 로딩바를 그냥 걷는다(막힌 이동 등). */
const GIVE_UP_MS = 12_000;

function ProgressBar() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const routeKey = `${pathname}?${search}`;

  // 링크를 누른 순간의 주소. 주소가 이 값에서 바뀌면 이동이 끝난 것이다.
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const routeKeyRef = useRef(routeKey);
  useEffect(() => {
    routeKeyRef.current = routeKey;
  }, [routeKey]);

  const running = startedAt !== null && startedAt === routeKey;
  const finishing = startedAt !== null && startedAt !== routeKey;

  // 사이트 안 링크를 누르거나 뒤로/앞으로 가기를 하면 시작한다.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a || !a.href) return;
      if (a.target && a.target !== "_self") return;
      if (a.hasAttribute("download")) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      // 같은 화면으로 가는 링크(또는 같은 문서 안 #앵커)는 화면이 안 바뀌니 건너뛴다.
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      setStartedAt(routeKeyRef.current);
    }
    function onPopState() {
      setStartedAt(routeKeyRef.current);
    }
    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPopState);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

  // 이동이 끝나면 꽉 찬 막대가 잠깐 보였다가 사라진 뒤 정리한다.
  useEffect(() => {
    if (!finishing) return;
    const t = setTimeout(() => setStartedAt(null), 500);
    return () => clearTimeout(t);
  }, [finishing]);

  // 이동이 끝나지 않는 채로 너무 오래 가면 포기한다.
  useEffect(() => {
    if (!running) return;
    const t = setTimeout(() => setStartedAt(null), GIVE_UP_MS);
    return () => clearTimeout(t);
  }, [running]);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px]">
      {(running || finishing) && (
        <div
          key={finishing ? "done" : "run"}
          data-nav-progress={finishing ? "done" : "run"}
          className={`h-full rounded-r-full bg-brand ${finishing ? "nav-progress-done" : "nav-progress-run"}`}
        />
      )}
    </div>
  );
}

/**
 * 화면을 옮기는 동안 맨 위에 얇은 로딩바를 보여준다. 눌렀을 때 곧바로 시작해 천천히 차오르고,
 * 새 화면으로 바뀌면 끝까지 차며 사라진다. (useSearchParams 때문에 Suspense 안에 둔다.)
 */
export function NavigationProgress() {
  return (
    <Suspense fallback={null}>
      <ProgressBar />
    </Suspense>
  );
}
