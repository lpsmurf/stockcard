/**
 * Storage for off-chain records (data-model.md "Off-chain records").
 * Uses the Upstash Redis REST API when KV_REST_API_URL/KV_REST_API_TOKEN are
 * set, otherwise an in-memory Map for local dev. All values are JSON.
 */
const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;

interface MemoryEntry {
  value: unknown;
  expiresAt?: number;
}

// globalThis so the fallback survives Next.js dev hot reloads.
const g = globalThis as unknown as { __stockcardMemoryKv?: Map<string, MemoryEntry> };
const memory = (g.__stockcardMemoryKv ??= new Map());

function live(entry: MemoryEntry | undefined): entry is MemoryEntry {
  if (!entry) return false;
  if (entry.expiresAt !== undefined && entry.expiresAt <= Date.now()) return false;
  return true;
}

async function redis<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${KV_URL}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${KV_TOKEN}`, "Content-Type": "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`KV request failed: ${res.status}`);
  const body = (await res.json()) as { result: T };
  return body.result;
}

export async function kvGet<T>(key: string): Promise<T | null> {
  if (KV_URL && KV_TOKEN) {
    const raw = await redis<string | null>(`/get/${encodeURIComponent(key)}`);
    return raw === null ? null : (JSON.parse(raw) as T);
  }
  const entry = memory.get(key);
  return live(entry) ? (entry.value as T) : null;
}

export async function kvSet(key: string, value: unknown, opts: { ttlSec?: number } = {}): Promise<void> {
  if (KV_URL && KV_TOKEN) {
    const cmd = ["SET", key, JSON.stringify(value)];
    if (opts.ttlSec) cmd.push("EX", String(opts.ttlSec));
    await redis("/", { method: "POST", body: JSON.stringify(cmd) });
    return;
  }
  memory.set(key, {
    value,
    expiresAt: opts.ttlSec ? Date.now() + opts.ttlSec * 1000 : undefined,
  });
}

/** Prepend to a list (newest first), trimming to maxLen. */
export async function kvListPush(key: string, value: unknown, opts: { maxLen?: number; ttlSec?: number } = {}): Promise<void> {
  const maxLen = opts.maxLen ?? 100;
  if (KV_URL && KV_TOKEN) {
    const encoded = encodeURIComponent(key);
    await redis(`/lpush/${encoded}/${encodeURIComponent(JSON.stringify(value))}`, { method: "POST" });
    await redis(`/ltrim/${encoded}/0/${maxLen - 1}`, { method: "POST" });
    if (opts.ttlSec) await redis(`/expire/${encoded}/${opts.ttlSec}`, { method: "POST" });
    return;
  }
  const entry = memory.get(key);
  const list = live(entry) && Array.isArray(entry.value) ? (entry.value as unknown[]) : [];
  list.unshift(value);
  memory.set(key, {
    value: list.slice(0, maxLen),
    expiresAt: opts.ttlSec ? Date.now() + opts.ttlSec * 1000 : undefined,
  });
}

export async function kvListRead<T>(key: string, limit = 100): Promise<T[]> {
  if (KV_URL && KV_TOKEN) {
    const raw = await redis<string[]>(`/lrange/${encodeURIComponent(key)}/0/${limit - 1}`);
    return raw.map((v) => JSON.parse(v) as T);
  }
  const entry = memory.get(key);
  if (!live(entry) || !Array.isArray(entry.value)) return [];
  return (entry.value as T[]).slice(0, limit);
}

/** Replace an entire list (delete + re-push in order). */
export async function kvListWrite(key: string, values: unknown[], opts: { ttlSec?: number } = {}): Promise<void> {
  if (KV_URL && KV_TOKEN) {
    const encoded = encodeURIComponent(key);
    await redis(`/del/${encoded}`, { method: "POST" });
    if (values.length > 0) {
      await redis(`/rpush/${encoded}/${values.map((v) => encodeURIComponent(JSON.stringify(v))).join("/")}`, { method: "POST" });
    }
    if (opts.ttlSec) await redis(`/expire/${encoded}/${opts.ttlSec}`, { method: "POST" });
    return;
  }
  memory.set(key, {
    value: [...values],
    expiresAt: opts.ttlSec ? Date.now() + opts.ttlSec * 1000 : undefined,
  });
}

/** Keys matching a glob pattern (e.g. "shop:*"). Redis KEYS; fine at demo scale. */
export async function kvKeys(pattern: string): Promise<string[]> {
  if (KV_URL && KV_TOKEN) {
    return redis<string[]>(`/keys/${encodeURIComponent(pattern)}`);
  }
  const regex = new RegExp(`^${pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\\\*/g, ".*")}$`);
  const out: string[] = [];
  for (const [key, entry] of memory) {
    if (live(entry) && regex.test(key)) out.push(key);
  }
  return out;
}
