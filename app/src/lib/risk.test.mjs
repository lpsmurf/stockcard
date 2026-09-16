// T056 checks: risk.ts against the demo script numbers in parameters.md §4.
// Run: node --test src/lib/risk.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  alertBand,
  availableCredit,
  collateralValue,
  fixAmounts,
  health,
  liquidationPrice,
  ltvBps,
  seizeAmount,
  selectAprBps,
  utilizationBps,
} from "./risk.ts";

// Demo position: 10 NVDAx (8 decimals, multiplier 1.001701) at $211.96, no haircut, max LTV 50%, liq 65%.
const AMOUNT = 10n * 10n ** 8n;
const MULT = 1_001_701n;
const PRICE = 211_960_000n;
const DEC = 8;
const value = collateralValue(AMOUNT, DEC, PRICE, 0n, MULT);

test("collateral value applies the Token-2022 multiplier", () => {
  // 10 × 1.001701 × $211.96 = $2,123.21
  assert.equal(value, 2_123_205_439n);
});

test("$500 borrowed is 23.6% LTV and 12.9% APR", () => {
  const ltv = ltvBps(500_000_000n, value);
  assert.equal(ltv, 2355n);
  assert.equal(selectAprBps([
    { maxLtvBps: 2000, aprBps: 990 },
    { maxLtvBps: 3500, aprBps: 1290 },
    { maxLtvBps: 5000, aprBps: 1490 },
  ], ltv), 1290);
  assert.equal(health(ltv, 5000n, 6500n), "healthy");
  assert.equal(alertBand(ltv, 5000n, 6500n, "equity"), "healthy");
});

test("available credit is max LTV minus debt", () => {
  assert.equal(availableCredit(500_000_000n, value, 5000n), 561_602_719n);
});

test("liquidation price: $1,000 on 10 NVDAx liquidates below $153.70", () => {
  const px = liquidationPrice(1_000_000_000n, AMOUNT, MULT, 0n, 6500n, DEC);
  assert.ok(px > 153_000_000n && px < 154_000_000n, `got ${px}`);
  // A $500 debt halves it.
  const half = liquidationPrice(500_000_000n, AMOUNT, MULT, 0n, 6500n, DEC);
  assert.ok(half > 76_000_000n && half < 77_500_000n, `got ${half}`);
});

test("demo crash −30% pushes a $1,000 position to liquidatable", () => {
  const crashed = collateralValue(AMOUNT, DEC, (PRICE * 70n) / 100n, 0n, MULT);
  const ltv = ltvBps(1_000_000_000n, crashed);
  assert.ok(ltv > 6500n && ltv < 6800n, `expected ~67.4%, got ${ltv}`);
  assert.equal(alertBand(ltv, 5000n, 6500n, "equity"), "liquidatable");
  assert.equal(health(ltv, 5000n, 6500n), "atRisk");
});

test("one 50% liquidation leaves the position no longer liquidatable (~52%)", () => {
  const crashedPrice = (PRICE * 70n) / 100n;
  const repay = 500_000_000n; // 50% close factor
  const seized = seizeAmount(repay, 500n, crashedPrice, MULT, DEC);
  const left = collateralValue(AMOUNT - seized, DEC, crashedPrice, 0n, MULT);
  const ltv = ltvBps(1_000_000_000n - repay, left);
  assert.ok(ltv > 5000n && ltv <= 5500n, `expected ~52%, got ${ltv}`);
  assert.equal(alertBand(ltv, 5000n, 6500n, "equity"), "watch");
});

test("alert bands follow parameters.md §4 for equities", () => {
  const b = (ltv) => alertBand(BigInt(ltv), 5000n, 6500n, "equity");
  assert.equal(b(4900), "healthy");
  assert.equal(b(5200), "watch");
  assert.equal(b(5600), "warning");
  assert.equal(b(6100), "urgent");
  assert.equal(b(6600), "liquidatable");
});

test("art and collectibles shift the bands with their own threshold", () => {
  // Art: liq 45% → warning above 35%, urgent above 40%.
  assert.equal(alertBand(3600n, 3000n, 4500n, "artNote"), "warning");
  assert.equal(alertBand(4100n, 3000n, 4500n, "artNote"), "urgent");
  assert.equal(alertBand(4600n, 3000n, 4500n, "artNote"), "liquidatable");
});

test("fix amounts bring an urgent position back to max LTV", () => {
  const crashedPrice = (PRICE * 70n) / 100n;
  const debt = 1_000_000_000n;
  const { addTokens, repayUsd6 } = fixAmounts(debt, AMOUNT, MULT, crashedPrice, 0n, 5000n, DEC);
  // Repaying the quoted amount lands at or under 50%.
  const after = ltvBps(debt - repayUsd6, collateralValue(AMOUNT, DEC, crashedPrice, 0n, MULT));
  assert.ok(after <= 5000n, `repay path left ${after}`);
  // Adding the quoted collateral does the same.
  const afterAdd = ltvBps(debt, collateralValue(AMOUNT + addTokens, DEC, crashedPrice, 0n, MULT));
  assert.ok(afterAdd <= 5000n, `add path left ${afterAdd}`);
  // Both are rounded in the protocol's favour, never below the need.
  assert.ok(repayUsd6 % 10_000n === 0n);
  assert.ok(addTokens % 10_000n === 0n);
});

test("a healthy position needs no fix", () => {
  const { addTokens, repayUsd6 } = fixAmounts(500_000_000n, AMOUNT, MULT, PRICE, 0n, 5000n, DEC);
  assert.equal(addTokens, 0n);
  assert.equal(repayUsd6, 0n);
});

test("savings utilization caps borrowing at 90%", () => {
  assert.equal(utilizationBps(810_000_000n, 1_000_000_000n), 8100n);
  assert.ok(utilizationBps(910_000_000n, 1_000_000_000n) > 9000n);
});
