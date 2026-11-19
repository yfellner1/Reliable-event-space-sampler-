"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Keeps a screen current: refreshes its data every `seconds` while the tab is
 * visible, and right away when the person comes back to it.
 */
export function AutoRefresh({ seconds = 30 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    const start = () => {
      clearInterval(timer);
      timer = setInterval(() => router.refresh(), seconds * 1000);
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        router.refresh();
        start();
      } else {
        clearInterval(timer);
      }
    };
    start();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [router, seconds]);
  return null;
}
