"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useWalletAuth } from "@/lib/wallet-auth";
import { useToast } from "./toast";

const DISMISS_KEY = "stockcard:alerts-dismissed";

type AlertsState = "checking" | "unsupported" | "denied" | "off" | "on";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

function getInitialDismissed() {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(DISMISS_KEY) === "1";
}

function subscribePermission(callback: () => void) {
  if (typeof navigator === "undefined" || !("permissions" in navigator)) return () => {};
  let status: PermissionStatus | undefined;
  navigator.permissions
    .query({ name: "notifications" as PermissionName })
    .then((s) => {
      status = s;
      status.addEventListener("change", callback);
    })
    .catch(() => {});
  return () => status?.removeEventListener("change", callback);
}

function getPermissionSnapshot() {
  if (typeof Notification === "undefined") return "default" as NotificationPermission;
  return Notification.permission;
}

/** T059 — Home card: turn on liquidation push alerts for this device. */
export function AlertsCard() {
  const { toast } = useToast();
  const walletAuth = useWalletAuth();
  const permission = useSyncExternalStore(subscribePermission, getPermissionSnapshot, () => "default");
  const [dismissed, setDismissed] = useState(getInitialDismissed);
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  const unsupported = useMemo(
    () =>
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !("Notification" in window) ||
      !vapidKey,
    [vapidKey],
  );

  useEffect(() => {
    if (unsupported) return;
    let active = true;
    navigator.serviceWorker
      .getRegistration("/sw.js")
      .then((reg) => reg?.pushManager.getSubscription())
      .then((sub) => {
        if (active) setSubscribed(!!sub);
      })
      .catch(() => {
        if (active) setSubscribed(false);
      });
    return () => {
      active = false;
    };
  }, [unsupported]);

  const state: AlertsState = useMemo(() => {
    if (unsupported) return "unsupported";
    if (permission === "denied") return "denied";
    if (subscribed === null) return "checking";
    return subscribed ? "on" : "off";
  }, [unsupported, permission, subscribed]);

  const turnOn = useCallback(async () => {
    if (!vapidKey) return;
    setBusy(true);
    try {
      const permissionResult = await Notification.requestPermission();
      if (permissionResult !== "granted") {
        setSubscribed(false);
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
      });
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: await walletAuth("/api/push/subscribe"),
        body: JSON.stringify({ subscription: subscription.toJSON() }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.message ?? "Subscription failed");
      setSubscribed(true);
      toast("Alerts are on for this device");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not turn on alerts", { variant: "error" });
    } finally {
      setBusy(false);
    }
  }, [vapidKey, walletAuth, toast]);

  const sendTest = useCallback(async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/push/test", { method: "POST", headers: await walletAuth("/api/push/test") });
      const body = (await res.json().catch(() => null)) as { sent?: number; skipped?: string; message?: string } | null;
      if (!res.ok) throw new Error(body?.message ?? "Test notification failed");
      if (!body?.sent) throw new Error(body?.skipped ?? "No devices registered");
      toast("Test notification sent");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Test notification failed", { variant: "error" });
    } finally {
      setBusy(false);
    }
  }, [walletAuth, toast]);

  if (state === "checking" || state === "unsupported" || (dismissed && state === "off")) return null;

  if (state === "on") {
    return (
      <div className="rounded-xl bg-surface p-4">
        <p className="text-sm font-semibold text-ink">Alerts are on for this device</p>
        <p className="mt-1 text-sm text-ink-3">We&apos;ll warn you before your position can be liquidated.</p>
        <button
          onClick={sendTest}
          disabled={busy}
          className="mt-3 flex min-h-[44px] items-center rounded-lg border border-rule px-4 text-sm font-semibold text-ink disabled:opacity-50"
        >
          {busy ? "Sending…" : "Send test notification"}
        </button>
      </div>
    );
  }

  if (state === "denied") {
    return (
      <div className="rounded-xl bg-surface p-4">
        <p className="text-sm font-semibold text-ink">Notifications are blocked</p>
        <p className="mt-1 text-sm text-ink-3">Allow notifications for this site in your browser settings to get liquidation alerts.</p>
      </div>
    );
  }

  return (
    <div className="relative rounded-xl bg-surface p-4">
      <button
        aria-label="Dismiss"
        onClick={() => {
          localStorage.setItem(DISMISS_KEY, "1");
          setDismissed(true);
        }}
        className="absolute right-2 top-2 flex min-h-[44px] min-w-[44px] items-center justify-center text-ink-3"
      >
        ✕
      </button>
      <p className="text-sm font-semibold text-ink">Get an alert before liquidation</p>
      <p className="mt-1 text-sm text-ink-3">We&apos;ll notify this device when a position gets close to its liquidation price.</p>
      <button
        onClick={turnOn}
        disabled={busy}
        className="mt-3 flex min-h-[44px] items-center rounded-lg bg-brass px-4 text-sm font-semibold text-on-brass disabled:opacity-50"
      >
        {busy ? "Turning on…" : "Turn on alerts"}
      </button>
    </div>
  );
}
