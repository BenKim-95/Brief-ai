"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { pathFromAppUrl } from "@/lib/native-link";

type CapacitorWindow = { Capacitor?: { isNativePlatform?: () => boolean } };

/**
 * Capacitor 앱 안에서만 동작한다. 폰 위젯을 눌러 앱이 열리면 네이티브가 기사 주소를 넘겨 주고(appUrlOpen),
 * 그 주소가 우리 사이트의 것이면 해당 화면으로 이동한다. 일반 브라우저에서는 아무 일도 하지 않고
 * Capacitor 코드도 내려받지 않는다.
 */
export function NativeLinkHandler() {
  const router = useRouter();

  useEffect(() => {
    if (!(window as unknown as CapacitorWindow).Capacitor?.isNativePlatform?.()) return;
    let cancelled = false;
    let remove: (() => void) | undefined;
    (async () => {
      const { App } = await import("@capacitor/app");
      const handle = await App.addListener("appUrlOpen", ({ url }) => {
        const path = pathFromAppUrl(url, window.location.origin);
        if (path) router.push(path);
      });
      if (cancelled) void handle.remove();
      else remove = () => void handle.remove();
    })().catch(() => {});
    return () => {
      cancelled = true;
      remove?.();
    };
  }, [router]);

  return null;
}
