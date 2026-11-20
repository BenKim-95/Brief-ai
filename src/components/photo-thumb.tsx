"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 사진 모음의 사진 한 장. 작은 사진을 보여 주고, 누르면 원본이 새 창에서 열린다.
 * 사진은 다른 사이트의 주소를 그대로 불러오며(우리 서버에 저장하지 않음), 열리지 않는 사진은 칸째 숨긴다.
 */
export function PhotoThumb({
  thumb,
  link,
  title,
  source,
}: {
  thumb: string;
  link: string;
  title: string;
  /** 출처로 보여 줄 사이트 이름(주소) */
  source: string;
}) {
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el && el.complete && el.naturalWidth === 0) setFailed(true);
  }, []);
  if (failed) return null;
  return (
    <li className="overflow-hidden rounded-2xl bg-surface">
      <a href={link} target="_blank" rel="noopener noreferrer" className="block" aria-label={`${title} 원본 보기 (새 창)`}>
        <div className="aspect-[4/3] w-full overflow-hidden bg-line">
          {/* eslint-disable-next-line @next/next/no-img-element -- 외부 사이트 사진이라 Next 이미지 최적화를 쓰지 않는다 */}
          <img
            ref={ref}
            src={thumb}
            alt={title}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={() => setFailed(true)}
            className="size-full object-cover"
          />
        </div>
        <p className="px-3 py-2 text-[11px] leading-snug text-sub">
          출처 {source || "인터넷"} · 원본 보기 ↗
        </p>
      </a>
    </li>
  );
}
