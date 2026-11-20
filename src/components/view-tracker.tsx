"use client";

import { useEffect, type ReactNode } from "react";

/** 서버가 하루 1회로 세므로, 같은 화면에서 여러 번 보내지 않게만 막는다. */
function ping(articleId: number) {
  try {
    const url = `/api/articles/${articleId}/view`;
    // 원문 사이트로 넘어가는 순간에도 요청이 끊기지 않도록 sendBeacon을 먼저 쓴다.
    if (!navigator.sendBeacon?.(url)) void fetch(url, { method: "POST", keepalive: true });
  } catch {
    // 조회수 기록이 안 돼도 화면은 그대로 동작한다.
  }
}

/** 기사 화면이 열리면 조회로 센다. 화면에는 아무것도 그리지 않는다. */
export function ViewPing({ articleId }: { articleId: number }) {
  useEffect(() => {
    ping(articleId);
  }, [articleId]);
  return null;
}

/** "원문 보기" 링크. 누르면 그 기사를 조회로 센다. */
export function OriginalLink({
  articleId,
  href,
  className,
  children,
}: {
  articleId: number;
  href: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      onClick={() => ping(articleId)}
      onAuxClick={() => ping(articleId)}
    >
      {children}
    </a>
  );
}
