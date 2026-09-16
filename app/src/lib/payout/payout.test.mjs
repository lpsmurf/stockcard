// Run: node --test src/lib/payout/payout.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { eurToUsdc6, stockcardFeeCents, sepaReference, MIN_EUR_CENTS, PURPOSE_REQUIRED_ABOVE_CENTS } from "./provider.ts";

test("fees follow parameters.md §3d", () => {
  assert.equal(stockcardFeeCents(50_000, "standard"), 250); // €500 → €2.50
  assert.equal(stockcardFeeCents(50_000, "plus"), 125); // 0.25%
  assert.equal(stockcardFeeCents(50_000, "black"), 0); // free
  assert.equal(stockcardFeeCents(1_000, "standard"), 100, "minimum €1 applies to small transfers");
});

test("EUR converts to USDC at the ECB rate, rounded up", () => {
  // €500.00 at 1 USD = 0.86573 EUR → 577.55 USDC (parameters.md §3d example)
  const usdc = eurToUsdc6(50_000, 0.86573);
  assert.ok(usdc >= 577_540_000n && usdc <= 577_560_000n, `got ${usdc}`);
  // Rounding never leaves us short of the euro amount.
  assert.equal(eurToUsdc6(1_000, 0.9) % 1n, 0n);
  assert.ok(eurToUsdc6(1_000, 0.9) >= 11_111_111n);
});

test("limits and reference format", () => {
  assert.equal(MIN_EUR_CENTS, 1_000);
  assert.equal(PURPOSE_REQUIRED_ABOVE_CENTS, 1_000_000);
  assert.match(sepaReference(), /^SC-[A-Z2-9]{6}$/);
});
