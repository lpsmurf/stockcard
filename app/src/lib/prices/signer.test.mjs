// Run: node --test src/lib/prices/signer.test.mjs   (Node 22.18+ strips types from the imported .ts)
import { test } from "node:test";
import assert from "node:assert/strict";
import { decide, spreadBps } from "./signer.ts";

const now = Date.parse("2026-09-15T14:10:00Z");
const fresh = "2026-09-15T14:05:00Z";

const reading = (over = {}) => ({
  symbol: "NVDAx",
  primary: { name: "xstocks", price: 213.1345 },
  jupiter: { usdPrice: 213.2419, liquidity: 1_824_399, stockData: { id: "xstocks", price: 213.65, updatedAt: fresh } },
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
