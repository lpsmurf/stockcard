// Run: node --test src/lib/prices/signer.test.mjs   (Node 22.18+ strips types from the imported .ts)
import { test } from "node:test";
import assert from "node:assert/strict";
import { decide, spreadBps, usablePyth } from "./signer.ts";

const now = Date.parse("2026-09-15T14:10:00Z");
const fresh = "2026-09-15T14:05:00Z";

const pyth = (over = {}) => ({
  feedId: "b4ca9b9fb4d51b0c5a4e2e0b9c2f0a3f",
  price: 213.19,
  confBps: 12,
  publishTime: now - 20_000,
  ...over,
});

const reading = (over = {}) => ({
  symbol: "NVDAx",
  primary: { name: "xstocks", price: 213.1345 },
  jupiter: { usdPrice: 213.2419, liquidity: 1_824_399, stockData: { id: "xstocks", price: 213.65, updatedAt: fresh } },
  pyth: null,
  marketOpen: true,
  halted: false,
  ...over,
});

test("posts the mean when sources agree (live NVDAx numbers, Sept 15)", () => {
  const d = decide(reading(), "Market", now);
  assert.equal(d.action, "post");
  if (d.action === "post") {
    assert.equal(d.spreadBps, 5);
    assert.equal(d.priceE6, 213_188_200);
  }
});

test("skips when sources disagree by more than 200 bps", () => {
  const d = decide(reading({ jupiter: { usdPrice: 220, liquidity: 2e6, stockData: { id: "xstocks", price: 213, updatedAt: fresh } } }), "Market", now);
  assert.equal(d.action, "skip");
});

test("SPCX live spread (Backpack 146.73 vs Jupiter 144.91) is within the limit", () => {
  assert.ok(spreadBps(146.73, 144.91) <= 200);
});

test("never overwrites a demo crash", () => {
  assert.equal(decide(reading(), "Demo", now).action, "skip");
  assert.equal(decide(reading(), "demo", now).action, "skip");
});

test("skips halted, closed and stale markets", () => {
  assert.equal(decide(reading({ halted: true }), "Market", now).action, "skip");
  assert.equal(decide(reading({ marketOpen: false }), "Market", now).action, "skip");
  const stale = reading({ jupiter: { usdPrice: 213.2, liquidity: 2e6, stockData: { id: "xstocks", price: 213, updatedAt: "2026-09-15T13:00:00Z" } } });
  assert.equal(decide(stale, "Market", now).action, "skip");
});

test("falls back to the primary price when Jupiter liquidity is thin", () => {
  const d = decide(reading({ jupiter: { usdPrice: 213.2, liquidity: 50_000 } }), null, now);
  assert.equal(d.action, "post");
  if (d.action === "post") assert.equal(d.spreadBps, null);
});

test("skips when the primary source is down", () => {
  assert.equal(decide(reading({ primary: null }), "Market", now).action, "skip");
});

test("averages all three sources when Pyth agrees", () => {
  const d = decide(reading({ pyth: pyth() }), "Market", now);
  assert.equal(d.action, "post");
  if (d.action === "post") {
    assert.deepEqual(d.sources, ["xstocks", "jupiter", "pyth"]);
    assert.equal(d.spreadBps, 5);
    assert.equal(d.priceE6, 213_188_800);
  }
});

test("Pyth breaks the tie instead of going dark when two sources disagree", () => {
  // Jupiter is 300 bps off; xStocks and Pyth agree, so we post their mean and log the outlier.
  const d = decide(
    reading({
      jupiter: { usdPrice: 219.6, liquidity: 2e6, stockData: { id: "xstocks", price: 213, updatedAt: fresh } },
      pyth: pyth(),
    }),
    "Market",
    now,
  );
  assert.equal(d.action, "post");
  if (d.action === "post") {
    assert.deepEqual(d.sources, ["xstocks", "pyth"]);
    assert.match(d.note ?? "", /dropped jupiter as outlier/);
  }
});

test("still skips when no two of the three agree", () => {
  const d = decide(
    reading({
      jupiter: { usdPrice: 219.6, liquidity: 2e6, stockData: { id: "xstocks", price: 213, updatedAt: fresh } },
      pyth: pyth({ price: 228.4 }),
    }),
    "Market",
    now,
  );
  assert.equal(d.action, "skip");
});

test("Pyth keeps pricing when the issuer API is down", () => {
  const d = decide(reading({ primary: null, pyth: pyth() }), "Market", now);
  assert.equal(d.action, "post");
  if (d.action === "post") assert.deepEqual(d.sources, ["jupiter", "pyth"]);
});

test("rejects stale or wide-confidence Pyth readings", () => {
  assert.equal(usablePyth(pyth(), now), true);
  assert.equal(usablePyth(pyth({ publishTime: now - 10 * 60_000 }), now), false);
  assert.equal(usablePyth(pyth({ confBps: 250 }), now), false);
  assert.equal(usablePyth(null, now), false);
  // A stale Pyth reading can't rescue a down issuer either.
  assert.equal(decide(reading({ primary: null, pyth: pyth({ confBps: 250 }) }), "Market", now).action, "skip");
});
