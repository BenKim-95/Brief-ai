"use client";

import { useState } from "react";

export type Bar = {
  key: string;
  /** 가로축에 찍는 글자 */
  label: string;
  value: number;
  /** 막대를 누르거나 올렸을 때 위에 보여 주는 한 줄 설명(스크린 리더용 이름도 겸한다) */
  detail: string;
};

/**
 * 막대 하나짜리 간단한 차트(차트 라이브러리 없이). 막대 하나가 한 칸이고 마지막 칸(오늘)이 진하게 나온다.
 * 막대에 마우스를 올리거나 누르거나 키보드로 옮기면 위쪽에 그 칸의 값이 나온다. 색만으로 구분하지 않도록
 * 값은 항상 글자로도 나오고, 표로 보기는 화면 쪽에서 따로 둔다.
 */
export function BarChart({
  title,
  bars,
  tickEvery,
  tickFrom = "end",
  initial,
  emptyText,
}: {
  title: string;
  bars: Bar[];
  /** 가로축 글자를 몇 칸마다 찍을지 */
  tickEvery: number;
  /** "end" 면 마지막 칸부터 거꾸로 세어 오늘이 항상 찍히고, "start" 면 첫 칸부터 센다 */
  tickFrom?: "start" | "end";
  /** 처음에 값을 보여 줄 칸(기본: 마지막 칸) */
  initial?: number;
  emptyText: string;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const max = Math.max(0, ...bars.map((b) => b.value));
  const sel = picked !== null && picked < bars.length ? picked : Math.min(initial ?? bars.length - 1, bars.length - 1);
  const current = bars[sel];

  return (
    <figure className="rounded-2xl border border-line bg-surface p-4">
      <figcaption className="text-sm font-bold">{title}</figcaption>
      <p aria-live="polite" className="mt-0.5 min-h-5 text-sm text-sub" data-chart-readout>
        {current?.detail}
      </p>
      {max === 0 ? (
        <p className="py-10 text-center text-sm text-sub">{emptyText}</p>
      ) : (
        <>
          <div className="relative mt-3">
            <span className="absolute -top-0.5 right-0 text-[11px] text-sub">최대 {max.toLocaleString("ko-KR")}</span>
            <div role="group" aria-label={title} className="flex h-32 items-end gap-0.5 border-b border-line pt-4">
              {bars.map((b, i) => {
                const h = b.value === 0 ? 0 : Math.max(4, Math.round((b.value / max) * 100));
                const on = i === sel;
                return (
                  <button
                    key={b.key}
                    type="button"
                    aria-label={b.detail}
                    aria-pressed={on}
                    onMouseEnter={() => setPicked(i)}
                    onFocus={() => setPicked(i)}
                    onClick={() => setPicked(i)}
                    className="flex h-full min-w-0 flex-1 items-end rounded-t outline-none focus-visible:ring-2 focus-visible:ring-brand"
                  >
                    <span
                      className={`block w-full rounded-t-[4px] ${on ? "bg-brand" : "bg-brand/45"}`}
                      style={{ height: `${h}%` }}
                    />
                  </button>
                );
              })}
            </div>
          </div>
          <div aria-hidden className="mt-1 flex gap-0.5">
            {bars.map((b, i) => (
              <span key={b.key} className="relative h-4 min-w-0 flex-1 text-[10px] text-sub">
                {(tickFrom === "end" ? (bars.length - 1 - i) % tickEvery === 0 : i % tickEvery === 0) && (
                  <span className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap">{b.label}</span>
                )}
              </span>
            ))}
          </div>
        </>
      )}
    </figure>
  );
}
