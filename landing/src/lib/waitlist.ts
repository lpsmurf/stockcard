// Waitlist storage: Upstash Redis when KV_REST_API_URL/KV_REST_API_TOKEN are
// set; otherwise in-memory, persisted to WAITLIST_FILE when that env is set
// (used on the VPS deploy where Upstash is unreachable). Keys per brief §4:
//   waitlist:{email}  hash { email, code, assetToLock, cashbackAsset, wallet, ref, referralCount, joinedAt }
//   ref:{code}        email (referral-code lookup)
//   queue             sorted set, member = email, score = join order (ms timestamp)
//   rl:waitlist:{ip}  rate-limit counter, 1h TTL
//
// Referral bump: effective position = base position − 10 × confirmed referrals,
// clamped ≥ 1. Reward recorded on the referrer: "Plus cashback 3 months".

import { Redis } from "@upstash/redis";
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync, renameSync } from "node:fs";

export const REFERRAL_SPOTS_PER_FRIEND = 10;
export const REFERRAL_REWARD = "Plus cashback 3 months";
export const RATE_LIMIT_PER_HOUR = 5;

export const ASSET_TO_LOCK_OPTIONS = ["Stocks", "Graded cards", "Watches", "Art", "Not sure"] as const;
export const CASHBACK_ASSET_OPTIONS = ["NVDAx", "SPYx", "Art note", "Not sure"] as const;

const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com",
  "tempmail.com",
  "temp-mail.org",
  "10minutemail.com",
  "10minutemail.net",
  "guerrillamail.com",
  "guerrillamail.net",
  "sharklasers.com",
  "yopmail.com",
  "trashmail.com",
  "getnada.com",
  "dispostable.com",
  "fakeinbox.com",
  "maildrop.cc",
  "mintemail.com",
]);

export type WaitlistInput = {
  email: string;
  assetToLock: string;
  cashbackAsset: string;
  wallet?: string;
  ref?: string;
};

export type WaitlistRecord = {
  email: string;
  code: string;
  referralCount: number;
};

export type SignupResult =
  | { ok: true; position: number; referralCode: string; referralUrl: string; alreadyJoined: boolean }
  | { ok: false; error: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const WALLET_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/; // base58, Solana address shape

const redis =
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN
    ? new Redis({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN })
    : null;

// --- in-memory fallback, optionally persisted to WAITLIST_FILE (VPS deploys
// where Upstash is unreachable; dev leaves it unset) --------------------------
const mem = {
  records: new Map<string, Record<string, string>>(), // email -> hash fields
  codes: new Map<string, string>(), // code -> email
  queue: [] as string[], // join order
  rl: new Map<string, { count: number; resetAt: number }>(),
};

const STORE_FILE = process.env.WAITLIST_FILE;

function loadMem() {
  if (!STORE_FILE) return;
  try {
    const raw = JSON.parse(readFileSync(STORE_FILE, "utf8")) as {
      records?: Record<string, Record<string, string>>;
      codes?: Record<string, string>;
      queue?: string[];
    };
    for (const [k, v] of Object.entries(raw.records ?? {})) mem.records.set(k, v);
    for (const [k, v] of Object.entries(raw.codes ?? {})) mem.codes.set(k, v);
    mem.queue.push(...(raw.queue ?? []));
  } catch {
    /* fresh start */
  }
}
loadMem();

let persistTimer: ReturnType<typeof setTimeout> | null = null;
function persistMem() {
  if (!STORE_FILE || persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    try {
      writeFileSync(
        `${STORE_FILE}.tmp`,
        JSON.stringify({
          records: Object.fromEntries(mem.records),
          codes: Object.fromEntries(mem.codes),
          queue: mem.queue,
        }),
        { mode: 0o600 },
      );
      renameSync(`${STORE_FILE}.tmp`, STORE_FILE);
    } catch {
      /* keep serving in-memory */
    }
  }, 100);
}

function newCode(): string {
  return randomBytes(5).toString("hex"); // 10 hex chars
}

function siteUrl(origin?: string): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? origin ?? "http://localhost:3000";
}

export function validateInput(input: WaitlistInput): string | null {
  const email = input.email.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return "Enter a valid email address.";
  const domain = email.split("@")[1];
  if (DISPOSABLE_DOMAINS.has(domain)) return "Please use a permanent email address.";
  if (!ASSET_TO_LOCK_OPTIONS.includes(input.assetToLock as (typeof ASSET_TO_LOCK_OPTIONS)[number]))
    return "Choose what you would lock.";
  if (!CASHBACK_ASSET_OPTIONS.includes(input.cashbackAsset as (typeof CASHBACK_ASSET_OPTIONS)[number]))
    return "Choose a cashback asset.";
  if (input.wallet && !WALLET_RE.test(input.wallet.trim()))
    return "That doesn't look like a Solana address.";
  return null;
}

async function rateLimited(ip: string): Promise<boolean> {
  if (redis) {
    const key = `rl:waitlist:${ip}`;
    const n = await redis.incr(key);
    if (n === 1) await redis.expire(key, 3600);
    return n > RATE_LIMIT_PER_HOUR;
  }
  const now = Date.now();
  const entry = mem.rl.get(ip);
  if (!entry || entry.resetAt < now) {
    mem.rl.set(ip, { count: 1, resetAt: now + 3600_000 });
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_LIMIT_PER_HOUR;
}

function effectivePosition(base: number, referrals: number): number {
  return Math.max(1, base - REFERRAL_SPOTS_PER_FRIEND * referrals);
}

export async function addToWaitlist(raw: WaitlistInput, ip: string, origin?: string): Promise<SignupResult> {
  const error = validateInput(raw);
  if (error) return { ok: false, error };
  if (await rateLimited(ip || "unknown"))
    return { ok: false, error: "Too many signups from this network. Try again later." };

  const email = raw.email.trim().toLowerCase();
  const ref = raw.ref?.trim() || undefined;

  if (redis) {
    const existing = await redis.hgetall<Record<string, string>>(`waitlist:${email}`);
    if (existing && existing.code) {
      const rank = await redis.zrank("queue", email);
      const referrals = Number(existing.referralCount ?? 0);
      return {
        ok: true,
        position: effectivePosition((rank ?? 0) + 1, referrals),
        referralCode: existing.code,
        referralUrl: `${siteUrl(origin)}?ref=${existing.code}`,
        alreadyJoined: true,
      };
    }

    const code = newCode();
    const joinedAt = Date.now();
    await redis.hset(`waitlist:${email}`, {
      email,
      code,
      assetToLock: raw.assetToLock,
      cashbackAsset: raw.cashbackAsset,
      wallet: raw.wallet?.trim() ?? "",
      ref: ref ?? "",
      referralCount: "0",
      referralReward: "",
      joinedAt: String(joinedAt),
    });
    await redis.set(`ref:${code}`, email);
    await redis.zadd("queue", { score: joinedAt, member: email });

    if (ref) {
      const referrerEmail = await redis.get<string>(`ref:${ref}`);
      if (referrerEmail && referrerEmail !== email) {
        await redis.hincrby(`waitlist:${referrerEmail}`, "referralCount", 1);
        await redis.hset(`waitlist:${referrerEmail}`, { referralReward: REFERRAL_REWARD });
      }
    }

    const rank = (await redis.zrank("queue", email)) ?? 0;
    return {
      ok: true,
      position: rank + 1,
      referralCode: code,
      referralUrl: `${siteUrl(origin)}?ref=${code}`,
      alreadyJoined: false,
    };
  }

  // memory fallback
  const existingMem = mem.records.get(email);
  if (existingMem) {
    const base = mem.queue.indexOf(email) + 1;
    return {
      ok: true,
      position: effectivePosition(base, Number(existingMem.referralCount ?? 0)),
      referralCode: existingMem.code,
      referralUrl: `${siteUrl(origin)}?ref=${existingMem.code}`,
      alreadyJoined: true,
    };
  }
  const code = newCode();
  mem.records.set(email, {
    email,
    code,
    assetToLock: raw.assetToLock,
    cashbackAsset: raw.cashbackAsset,
    wallet: raw.wallet?.trim() ?? "",
    ref: ref ?? "",
    referralCount: "0",
    joinedAt: String(Date.now()),
  });
  mem.codes.set(code, email);
  mem.queue.push(email);
  if (ref) {
    const referrerEmail = mem.codes.get(ref);
    if (referrerEmail && referrerEmail !== email) {
      const r = mem.records.get(referrerEmail)!;
      r.referralCount = String(Number(r.referralCount ?? 0) + 1);
      r.referralReward = REFERRAL_REWARD;
    }
  }
  persistMem();
  return {
    ok: true,
    position: mem.queue.length,
    referralCode: code,
    referralUrl: `${siteUrl(origin)}?ref=${code}`,
    alreadyJoined: false,
  };
}

export async function getWaitlistStatus(
  code: string
): Promise<{ position: number; referralCount: number } | null> {
  if (redis) {
    const email = await redis.get<string>(`ref:${code}`);
    if (!email) return null;
    const rec = await redis.hgetall<Record<string, string>>(`waitlist:${email}`);
    const rank = await redis.zrank("queue", email);
    if (rank === null || !rec) return null;
    const referrals = Number(rec.referralCount ?? 0);
    return { position: effectivePosition(rank + 1, referrals), referralCount: referrals };
  }
  const email = mem.codes.get(code);
  if (!email) return null;
  const rec = mem.records.get(email);
  if (!rec) return null;
  const referrals = Number(rec.referralCount ?? 0);
  return {
    position: effectivePosition(mem.queue.indexOf(email) + 1, referrals),
    referralCount: referrals,
  };
}
