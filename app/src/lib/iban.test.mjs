// Run: node --test src/lib/iban.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { formatIban, maskIban, normalizeIban, validateIban } from "./iban.ts";

test("accepts valid SEPA IBANs", () => {
  for (const iban of [
    "NL91ABNA0417164300", // Netherlands (the spec's example)
    "DE89 3704 0044 0532 0130 00", // Germany, with spaces
    "BE68539007547034", // Belgium
    "FR1420041010050500013M02606", // France, with a letter in the body
    "IE26MODR99035507970528", // Ireland (Bridge's docs example)
  ]) {
    const r = validateIban(iban);
    assert.equal(r.ok, true, `${iban}: ${r.message}`);
    assert.equal(r.normalized, normalizeIban(iban));
  }
});

test("rejects a wrong check digit", () => {
  const r = validateIban("NL92ABNA0417164300");
  assert.equal(r.ok, false);
  assert.equal(r.error, "BAD_CHECKSUM");
  assert.equal(r.message, "Check the IBAN: the check digits don't match.");
});

test("rejects non-SEPA countries", () => {
  const r = validateIban("US64SVBKUS6S3300958879");
  assert.equal(r.error, "NOT_SEPA");
  assert.equal(r.message, "We can only send to SEPA bank accounts for now.");
});

test("rejects the wrong length for a country", () => {
  assert.equal(validateIban("NL91ABNA041716430").error, "BAD_LENGTH");
  assert.equal(validateIban("DE8937040044053201300").error, "BAD_LENGTH");
});

test("rejects empty and junk input", () => {
  assert.equal(validateIban("").error, "EMPTY");
  assert.equal(validateIban("NL91-ABNA-0417-164300!").error, "BAD_CHARS");
  assert.equal(validateIban("NL9").error, "TOO_SHORT");
});

test("formats and masks for display", () => {
  assert.equal(formatIban("nl91abna0417164300"), "NL91 ABNA 0417 1643 00");
  assert.equal(maskIban("NL91ABNA0417164300"), "•••• 4300");
});
