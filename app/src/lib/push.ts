/**
 * Web push for liquidation alerts (T059/T060, parameters.md §4 "Push copy").
 * Server only: imports VAPID_PRIVATE_KEY.
 *
 * Storage (data-model.md): `push:{owner}` holds up to 5 device subscriptions;
 * `alert:{owner}:{market}` holds the last band we notified, so each band fires once.
 */
import webpush, { type PushSubscription } from "web-push";
import { kvGet, kvSet } from "./kv";
import type { AlertBand } from "./risk";
export { alertCopy, shouldNotify } from "./push-copy";

export const MAX_DEVICES = 5;

let configured = false;
function configure(): boolean {
  if (configured) return true;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? "mailto:littleplu@gmail.com", publicKey, privateKey);
  configured = true;
  return true;
}

export interface StoredSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  createdAt: number;
}

export interface AlertPayload {
  title: string;
  body: string;
  market: string;
  band: AlertBand;
  url: string;
}

export async function listSubscriptions(owner: string): Promise<StoredSubscription[]> {
  return (await kvGet<StoredSubscription[]>(`push:${owner}`)) ?? [];
}

export async function addSubscription(owner: string, sub: StoredSubscription): Promise<number> {
  const existing = (await listSubscriptions(owner)).filter((s) => s.endpoint !== sub.endpoint);
  const next = [...existing, sub].slice(-MAX_DEVICES);
  await kvSet(`push:${owner}`, next);
  return next.length;
}

export async function removeSubscription(owner: string, endpoint: string): Promise<boolean> {
  const existing = await listSubscriptions(owner);
  const next = existing.filter((s) => s.endpoint !== endpoint);
  await kvSet(`push:${owner}`, next);
  return next.length !== existing.length;
}

/** Sends to every device; drops subscriptions the push service has expired (404/410). */
export async function sendToOwner(owner: string, payload: AlertPayload): Promise<{ sent: number; dropped: number; skipped?: string }> {
  if (!configure()) return { sent: 0, dropped: 0, skipped: "VAPID keys not configured" };
  const subs = await listSubscriptions(owner);
  if (!subs.length) return { sent: 0, dropped: 0, skipped: "no devices registered" };

  let sent = 0;
  const dead: string[] = [];
  await Promise.all(
    subs.map(async (s) => {
      const sub: PushSubscription = { endpoint: s.endpoint, keys: s.keys };
      try {
        await webpush.sendNotification(sub, JSON.stringify(payload));
        sent += 1;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) dead.push(s.endpoint);
      }
    }),
  );
  if (dead.length) {
    await kvSet(`push:${owner}`, subs.filter((s) => !dead.includes(s.endpoint)));
  }
  return { sent, dropped: dead.length };
}

export async function readLastBand(owner: string, market: string): Promise<AlertBand | null> {
  return (await kvGet<AlertBand>(`alert:${owner}:${market}`)) ?? null;
}

export async function writeLastBand(owner: string, market: string, band: AlertBand): Promise<void> {
  await kvSet(`alert:${owner}:${market}`, band);
}
