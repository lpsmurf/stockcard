"use client";

import { useEffect } from "react";

/** Registers /sw.js once on app start so the PWA is installable. Production only — dev keeps hot reload clean. */
export function SwRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}
