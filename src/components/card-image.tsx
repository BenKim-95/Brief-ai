"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 기사 대표 사진. 언론사 서버의 사진 주소를 그대로 불러오며(우리 서버에 저장하지 않음),
 * 불러오지 못하면 영역째 숨겨서 빈 칸이 남지 않게 한다.
 * 사진은 분위기를 위한 것이라 대체 텍스트는 비워 둔다 (제목이 바로 아래에 있음).
 */
export function CardImage({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLImageElement>(null);

  // 서버가 그린 <img>가 하이드레이션 전에 이미 실패했다면 onError를 놓칠 수 있다.
  useEffect(() => {
    const el = ref.current;
    if (el && el.complete && el.naturalWidth === 0) setFailed(true);
  }, []);

  if (failed) return null;
  return (
    <div className="-mx-5 -mt-5 mb-4 overflow-hidden rounded-t-[18px] bg-line">
      {/* eslint-disable-next-line @next/next/no-img-element -- 외부 언론사 주소라 Next 이미지 최적화를 쓰지 않는다 */}
      <img
        ref={ref}
        src={src}
        alt=""
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className="aspect-[16/9] w-full object-cover"
      />
    </div>
  );
}
