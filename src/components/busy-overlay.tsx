"use client";

import { useEffect, useId, useState, useSyncExternalStore } from "react";

/**
 * 버튼을 누르고 기다리는 동안 화면 가운데에 보여 주는 로딩 안내.
 * 화면 안에서 `useBusy(진행 중인지, "안내 문구")`만 부르면 되고, 여러 곳이 동시에 켜져도 하나만 보인다.
 * 아주 빨리 끝나는 일은 깜빡이지 않도록 SHOW_AFTER_MS 뒤에야 나타난다.
 */

const SHOW_AFTER_MS = 200;
export const DEFAULT_BUSY_LABEL = "불러오는 중이에요…";

const active = new Map<string, string>();
const listeners = new Set<() => void>();
let snapshot = "";

function emit() {
  snapshot = [...active.values()].at(-1) ?? "";
  for (const l of listeners) l();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/** `on`이 true인 동안 가운데 로딩 안내를 켠다. */
export function useBusy(on: boolean, label: string = DEFAULT_BUSY_LABEL) {
  const id = useId();
  useEffect(() => {
    if (!on) return;
    active.set(id, label);
    emit();
    return () => {
      active.delete(id);
      emit();
    };
  }, [on, label, id]);
}

export function BusyOverlay() {
  const label = useSyncExternalStore(subscribe, () => snapshot, () => "");
  const [shown, setShown] = useState("");

  useEffect(() => {
    if (!label) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 외부 저장소가 꺼지면 바로 숨긴다
      setShown("");
      return;
    }
    const t = setTimeout(() => setShown(label), SHOW_AFTER_MS);
    return () => clearTimeout(t);
  }, [label]);

  if (!shown) return null;
  return (
    <div
      data-busy-overlay
      className="fixed inset-0 z-[110] grid place-items-center bg-black/25 px-5"
    >
      <div
        role="status"
        aria-live="polite"
        className="flex min-w-[200px] max-w-[320px] flex-col items-center gap-3 rounded-2xl bg-surface px-7 py-6 text-center shadow-lg"
      >
        <span
          aria-hidden
          className="size-9 animate-spin rounded-full border-4 border-line border-t-brand motion-reduce:animate-none"
        />
        <p className="text-sm font-bold text-ink">{shown}</p>
      </div>
    </div>
  );
}
