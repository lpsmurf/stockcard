/**
 * PSA cert verification — integrations.md "PSA: details".
 * Server-side only: the free tier is 100 calls/day and terms restrict use to confirming
 * certs, so we look up a cert once and cache the result in KV for 24h. When
 * PSA_API_TOKEN is not set every function returns null and the UI shows nothing.
 */

import { kvGet, kvSet } from "../kv";

const BASE = "https://api.psacard.com/publicapi";
const CACHE_TTL_SEC = 24 * 60 * 60;
const TIMEOUT_MS = 8_000;

export interface PsaCertResult {
  certNumber: string;
  /** PSA's own description of the certified item. */
  label: string | null;
  grade: string | null;
  verifiedAt: number;
}

interface PsaResponse {
  IsValidRequest?: boolean;
  PSACert?: {
    CertNumber?: string;
    LabelType?: string;
    GradeDescription?: string;
    CardGrade?: string;
    Subject?: string;
    Brand?: string;
    Year?: string;
  };
}

export function psaEnabled(): boolean {
  return Boolean(process.env.PSA_API_TOKEN);
}

/**
 * Verify a PSA cert number. Returns null when the token is missing, the API is
 * unreachable, or the cert does not validate. Cached for 24h per cert.
 */
export async function verifyCert(certNumber: string): Promise<PsaCertResult | null> {
  const token = process.env.PSA_API_TOKEN;
  if (!token || !certNumber) return null;

  const cacheKey = `psa:cert:${certNumber}`;
  try {
    const cached = await kvGet<PsaCertResult>(cacheKey);
    if (cached) return cached;
  } catch {
    // cache miss is fine
  }

  let body: PsaResponse;
  try {
    const res = await fetch(`${BASE}/cert/GetByCertNumber/${encodeURIComponent(certNumber)}`, {
      headers: { Authorization: `bearer ${token}`, Accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) return null;
    body = (await res.json()) as PsaResponse;
  } catch {
    return null;
  }
  if (!body.IsValidRequest || !body.PSACert) return null;

  const cert = body.PSACert;
  const labelParts = [cert.Year, cert.Brand, cert.Subject].filter(Boolean);
  const result: PsaCertResult = {
    certNumber: cert.CertNumber ?? certNumber,
    label: labelParts.length > 0 ? labelParts.join(" ") : null,
    grade: cert.GradeDescription ?? cert.CardGrade ?? null,
    verifiedAt: Date.now(),
  };
  try {
    await kvSet(cacheKey, result, { ttlSec: CACHE_TTL_SEC });
  } catch {
    // uncached is fine
  }
  return result;
}
