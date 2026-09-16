// Run: node --test src/lib/balances.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildBalances, grossValueUsd6 } from "./balances-core.ts";
import { collateralValue } from "./risk.ts";

const usd = (n) => BigInt(Math.round(n * 1e6));

// parameters.md "Home balances" demo: 10 NVDAx locked at $211.96 = $2,119.60 · wallet $4,179.40 ·
// card $390.00 → total $6,689.00. Debt $500.00 → LTV 23.6% · debt is 7.5% of total.
const demo = () => ({
  markets: [
    {
      mint: "NVDA", symbol: "NVDAx", decimals: 8, multiplierMicro: 1_000_000n, priceUsd6: usd(211.96), source: "Market",
      walletAmount: 0n, lockedAmount: 10n * 10n ** 8n, lockedValueAfterHaircutUsd6: usd(2119.6), debtUsd6: usd(500),
    },
    {
      mint: "SPY", symbol: "SPYx", decimals: 8, multiplierMicro: 1_000_000n, priceUsd6: usd(761.76), source: "Market",
      walletAmount: 5n * 10n ** 8n, lockedAmount: 0n, lockedValueAfterHaircutUsd6: 0n, debtUsd6: 0n,
    },
  ],
  cardUsdc6: usd(390),
  sol: { lamports: 3_706_000_000n, priceUsd6: usd(100) },
});

test("reproduces the parameters.md demo numbers", () => {
  const b = buildBalances(demo());
  assert.equal(b.totals.lockedUsd6, usd(2119.6));
  assert.equal(b.totals.walletUsd6, usd(4179.4)); // 5 SPYx $3,808.80 + 3.706 SOL $370.60
  assert.equal(b.totals.cardUsd6, usd(390));
  assert.equal(b.totals.totalUsd6, usd(6689));
  assert.equal(b.ltvBps, 2358n); // 23.58% → "23.6%"
  assert.equal(b.debtOfTotalBps, 747n); // 7.47% → "7.5%"
});

test("LTV uses the haircut value; the owned total does not", () => {
  const input = demo();
  input.markets[0].lockedValueAfterHaircutUsd6 = usd(1059.8); // a 50% haircut market
  const b = buildBalances(input);
  assert.equal(b.totals.lockedUsd6, usd(2119.6), "what you own is unchanged");
  assert.equal(b.ltvBps, 4717n, "but the position is twice as leveraged");
});

test("unpriced tokens are listed but never counted", () => {
  const input = demo();
  input.otherTokens = [{ mint: "Mystery1111111111111111111111111111111111111", amount: 42n, decimals: 0 }];
  input.sol.priceUsd6 = null;
  const b = buildBalances(input);
  const mystery = b.wallet.find((h) => h.mint.startsWith("Mystery"));
  const sol = b.wallet.find((h) => h.symbol === "SOL");
  assert.equal(mystery.priceUsd6, null);
  assert.equal(mystery.symbol, "Myst…1111");
  assert.equal(sol.priceSource, "none");
  assert.equal(b.totals.walletUsd6, usd(3808.8), "only SPYx counts");
  assert.equal(b.wallet.at(-1).priceUsd6, null, "No price rows sort last");
});

test("SOL and unknown tokens are never eligible collateral", () => {
  const input = demo();
  input.otherTokens = [{ mint: "Other111", amount: 1n, decimals: 0 }];
  const b = buildBalances(input);
  assert.equal(b.wallet.find((h) => h.symbol === "SOL").eligible, false);
  assert.equal(b.wallet.find((h) => h.mint === "Other111").eligible, false);
  assert.equal(b.wallet.find((h) => h.symbol === "SPYx").eligible, true);
});

test("no debt means no ratios, and an empty wallet doesn't divide by zero", () => {
  const empty = buildBalances({ markets: [], cardUsdc6: 0n });
  assert.equal(empty.totals.totalUsd6, 0n);
  assert.equal(empty.ltvBps, 0n);
  assert.equal(empty.debtOfTotalBps, 0n);
});

test("gross value matches risk.ts collateralValue with no haircut, incl. the Scaled UI multiplier", () => {
  const amount = 12_345_678_901n; // 123.45678901 NVDAx
  const price = usd(213.19);
  assert.equal(grossValueUsd6(amount, 8, price, 1_001_701n), collateralValue(amount, 8, price, 0n, 1_001_701n));
});
