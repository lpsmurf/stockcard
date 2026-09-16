// Run: node --test src/lib/prices/preipo.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { PREIPO_ASSETS, conservativePrice, fetchPreStocks, fetchTessera, premiumBps, readPreIpo } from "./preipo.ts";

// Live rows, checked Sept 16. SPACEX trades 21% under NAV, ANDURIL 1.3% over.
const prestocksBody = [
  { symbol: "ANDURIL", contract_address: "PresTj4Yc2bAR197Er7wz4UUKSfqt6FryBEdAriBoQB", markPrice: 150.9664278, tokenPrice: 152.87394667567378 },
  { symbol: "ANTHROPIC", contract_address: "Pren1FvFX6J3E4kXhJuCiAD5aDmGEb7qJRncwA8Lkhw", markPrice: 1008.28819105, tokenPrice: 961.1323231247987 },
  { symbol: "SPACEX", contract_address: "PreANxuXjsy2pvisWWMNB6YaJNzr7681wJJr2rHsfTh", markPrice: 143.9675149121738, tokenPrice: 113.42641970971314 },
];
const tesseraBody = [
  { symbol: "T-OpenAI", mint: "oPAiAikWTaFj9RYoRFD35ccfwhnMcB3ThgBZRHSkjTZ", markPrice: 812.79 },
  { symbol: "T-Kalshi", mint: "TKLSidmLVt3cqGaaodG8tyRzoANfQwoh67AccjmubeZ", markPrice: 413.8 },
];

const stubFetch = (map) => async (url) => {
  const body = Object.entries(map).find(([key]) => String(url).includes(key))?.[1];
  if (!body) return { ok: false, status: 404, json: async () => ({}) };
  return { ok: true, status: 200, json: async () => body };
};

const liveFetch = stubFetch({ "prestocks.com": prestocksBody, "tessera.pe": tesseraBody });

test("lends against NAV, never against a premium", () => {
  assert.equal(conservativePrice(150.9664278, 152.87394667567378), 150.9664278);
  assert.equal(conservativePrice(143.9675149121738, 113.42641970971314), 113.42641970971314);
  assert.equal(conservativePrice(812.79, undefined), 812.79);
  assert.equal(conservativePrice(0, 0), null);
});

test("reports the premium for context", () => {
  assert.equal(premiumBps(150.9664278, 152.87394667567378), 126);
  assert.equal(premiumBps(143.9675149121738, 113.42641970971314), -2121);
  assert.equal(premiumBps(812.79, undefined), undefined);
});

test("reads both providers and keys them by our symbols", async () => {
  const out = await readPreIpo(["T-OPENAI", "PRE-SPACEX", "PRE-ANTHROPIC"], liveFetch);
  assert.deepEqual(Object.keys(out).sort(), ["PRE-ANTHROPIC", "PRE-SPACEX", "T-OPENAI"]);
  assert.equal(out["T-OPENAI"].provider, "tessera");
  assert.equal(out["PRE-SPACEX"].price, 113.42641970971314);
  assert.equal(out["PRE-ANTHROPIC"].price, 961.1323231247987);
});

test("one provider going down doesn't take the other with it", async () => {
  const out = await readPreIpo(["T-OPENAI", "PRE-SPACEX"], stubFetch({ "tessera.pe": tesseraBody }));
  assert.deepEqual(Object.keys(out), ["T-OPENAI"]);
});

test("ignores symbols we don't list and never invents a market", async () => {
  assert.deepEqual(await readPreIpo(["NVDAx"], liveFetch), {});
  const prestocks = await fetchPreStocks(liveFetch);
  assert.equal(prestocks.NEURALINK, undefined);
  const tessera = await fetchTessera(liveFetch);
  assert.equal(tessera["T-SpaceX"], undefined);
});

test("every listed asset carries the mainnet mint used for the Jupiter cross-check", () => {
  for (const asset of PREIPO_ASSETS) {
    assert.match(asset.mainnetMint, /^[1-9A-HJ-NP-Za-km-z]{32,44}$/, `${asset.symbol} mint`);
  }
});
