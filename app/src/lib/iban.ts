/**
 * IBAN validation for SEPA payouts (T079, FR-080). Pure module, no imports, so it runs
 * in the browser, on the server and under `node --test`.
 *
 * Checks: SEPA country, that country's length, the alphabet, and the ISO 13616 mod-97 checksum.
 */

/** SEPA scheme countries with their IBAN length (Bridge's supported list, parameters.md §3d). */
export const SEPA_IBAN_LENGTH: Record<string, number> = {
  AD: 24, AT: 20, AL: 28, BE: 16, BG: 22, CH: 21, CY: 28, CZ: 24, DE: 22, DK: 18,
  EE: 20, ES: 24, FI: 18, FR: 27, GB: 22, GI: 23, GR: 27, HR: 21, HU: 28, IE: 22,
  IS: 26, IT: 27, LI: 21, LT: 20, LU: 20, LV: 21, MC: 27, MD: 24, ME: 22, MK: 19,
  MT: 31, NL: 18, NO: 15, PL: 28, PT: 25, RO: 24, RS: 22, SE: 24, SI: 19, SK: 24,
  SM: 27, VA: 22,
};

export type IbanError =
  | "EMPTY"
  | "TOO_SHORT"
  | "BAD_CHARS"
  | "NOT_SEPA"
  | "BAD_LENGTH"
  | "BAD_CHECKSUM";

export interface IbanResult {
  ok: boolean;
  error?: IbanError;
  message?: string;
  /** Uppercase, spaces removed. */
  normalized?: string;
  country?: string;
  last4?: string;
}

const MESSAGES: Record<IbanError, string> = {
  EMPTY: "Enter the IBAN of the account you want the money in.",
  TOO_SHORT: "That IBAN looks too short. Check it against your bank app.",
  BAD_CHARS: "An IBAN only contains letters and numbers.",
  NOT_SEPA: "We can only send to SEPA bank accounts for now.",
  BAD_LENGTH: "That IBAN has the wrong number of characters for its country.",
  BAD_CHECKSUM: "Check the IBAN: the check digits don't match.",
};

export function normalizeIban(raw: string): string {
  return raw.replace(/[\s-]/g, "").toUpperCase();
}

/** Group in fours for display: NL91 ABNA 0417 1643 00 */
export function formatIban(raw: string): string {
  return normalizeIban(raw).replace(/(.{4})/g, "$1 ").trim();
}

/** Mask all but the last 4: •••• 4300 */
export function maskIban(raw: string): string {
  const iban = normalizeIban(raw);
  return iban.length >= 4 ? `•••• ${iban.slice(-4)}` : "••••";
}

function mod97(iban: string): number {
  // Move the first four characters to the end, map letters to numbers, then mod 97 in chunks.
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const ch of rearranged) {
    const value = ch >= "A" && ch <= "Z" ? (ch.charCodeAt(0) - 55).toString() : ch;
    for (const digit of value) remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder;
}

export function validateIban(raw: string): IbanResult {
  const iban = normalizeIban(raw ?? "");
  const fail = (error: IbanError): IbanResult => ({ ok: false, error, message: MESSAGES[error] });

  if (!iban) return fail("EMPTY");
  if (!/^[A-Z0-9]+$/.test(iban)) return fail("BAD_CHARS");
  if (iban.length < 5) return fail("TOO_SHORT");

  const country = iban.slice(0, 2);
  const expected = SEPA_IBAN_LENGTH[country];
  if (!expected) return fail("NOT_SEPA");
  if (iban.length !== expected) return fail("BAD_LENGTH");
  if (!/^\d{2}$/.test(iban.slice(2, 4))) return fail("BAD_CHECKSUM");
  if (mod97(iban) !== 1) return fail("BAD_CHECKSUM");

  return { ok: true, normalized: iban, country, last4: iban.slice(-4) };
}
