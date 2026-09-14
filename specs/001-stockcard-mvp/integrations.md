# RWA integrations: which partners have open APIs

Checked Sept 14, 2026 against each provider's own docs, plus live calls to the xStocks public API. "Open" means we can call it today without a partnership. These are integration targets; no partnerships exist.

## Summary

| Provider | Asset | Public API? | Auth | What it gives us for collateral | MVP use |
|---|---|---|---|---|---|
| **xStocks (Backed)** | Tokenized stocks | ✅ Yes (public endpoints) | None for public; `X-API-KEY` for client/trading | Asset list with **Solana mint addresses**, indicative price, **multiplier** (dividends/splits), **trading-halt status**, **proof of reserves**, official **Pyth/Chainlink feed IDs**, corporate-action calendar | **Yes, core** |
| **Pyth** | Equity prices | ⚠️ Paid for equities | Pro key works for crypto; equities/xStocks return 403 "Not entitled"; equity access quoted ~$2,500/month | Official xStocks feed (Lazer id 1833 = NVDAXUSD) | **No (production option)** |
| **Chainlink Data Streams** | Equity + xStocks prices | 💲 Self-serve, paid | app.chain.link; from $150/month per feed, no free tier; Solana verifier exists, devnet unconfirmed | Official xStocks oracle, 24/5 US equities | **No (production path)** |
| **Switchboard On-Demand** | Custom feeds | ✅ Permissionless | None; SOL fees per update; devnet supported | Oracle-signed feed built from our chosen public sources | **Spike Wed, go/no-go 12:00 ET** |
| **Jupiter Price v3** | Token prices | ✅ Yes | None on `lite-api.jup.ag` (checked Sept 14) | `usdPrice`, pool `liquidity`, xStocks `stockData.price` and `scaledUiConfig` multiplier | **Yes, price signer source** |
| **Collector Crypt** | Graded cards (Pokémon etc.) | ✅ Yes (marketplace read + builders) | None (optional `ccsk_` key for higher limits); gacha and shipping need partner registration | Per-card **insuredValue**, grade, grading company, **grading cert ID**, NFT standard, owner, live listings and offers; devnet API | **Yes, collectibles pricing + liquidation path** |
| **PSA** | Grading certs | ✅ Yes (free token) | Bearer token from PSA account | Cert lookup → confirms card, grade, label. **100 calls/day free**, terms restrict use to verifying certs | **Yes, verification only** (cache results) |
| **Backpack** | SPCX + broker stocks | ✅ Yes (public + signed) | None for public; ED25519 for account | **SPCX Solana mint**, deposit/withdraw status, spot/perp/external prices, order book depth, its own collateral haircuts, session calendar; user balances (signed) | **Yes, SPCX pricing/eligibility now; import P3** |
| **Jupiter** | Swaps / prices | ✅ Yes | `x-api-key` (free plan at portal.jup.ag) | Swap routing and Price API v3 for cashback purchases of xStocks | Post-MVP (mock cashback treasury in MVP) |
| **WatchCharts** | Watches | 💲 Paid | API key, Professional + API plan (trial on request) | Model lookup, market price, price history, appraisals | Post-MVP (watches ship end 2026 anyway) |
| **ALT (alt.xyz)** | Card values | ⚠️ Not publicly documented | Contact Alt | "Alt Value" FMV with confidence, daily updates; Beezie uses it | Partnership ask |
| **Phygitals** | Graded cards | ❌ No public API found | n/a | Docs cover tokenization (Solana NFTs, cert number in metadata), 85% FMV pack buyback, and its **own pawn loans** | Read on-chain metadata only; partnership ask |
| **Beezie** | Cards, luxury, watches | ❌ No public API found | n/a | Docs are product and user guides only | Partnership ask |
| **Luxembourg SV / freeport / appraisers** | Art | ❌ No | n/a | Appraisals arrive as documents; we post them with the `Signed` oracle | Signed prices (as specced) |

**Bottom line:** stock prices can be automated today for free with a price signer (xStocks + Jupiter, Backpack for SPCX) and optionally Switchboard; official oracles (Chainlink, Pyth) are paid and are the production path. Graded cards can be priced and verified today (Collector Crypt `insuredValue` + PSA cert), but liquidation still means selling on a marketplace. Watches and art stay on admin-signed prices until a partner or paid feed is in place.

## xStocks (Backed): details

Base URL: `https://api.backed.fi/api/v2` (docs: docs.xstocks.fi/apis/openapi). Public, no key.

| Endpoint | Use in StockCard |
|---|---|
| `GET /public/assets` / `GET /public/assets/{symbol}` | Market list: Solana mint address (`deployments[network=Solana].address`), ISIN, underlying, trading hours mode, halt flag |
| `GET /public/assets/{symbol}/price-data` | Indicative price `{ quote }`, price signer source #1 (with Jupiter as #2) |
| `GET /public/assets/{symbol}/multiplier?network=Solana` | `{ currentMultiplier, newMultiplier, activationDateTime }` |
| `GET /public/system/status/{symbol}` | `{ isMarketTradingHalted, isAtomicTradingHalted }` → pause new borrows on that market |
| `GET /public/proof-of-reserves/{symbol}` | `sharesHeld` vs `circulatingSupply` → pause the market if reserves < supply |
| `GET /public/oracles/{symbol}?network=Solana` | Official Pyth (Lazer + Hermes) and Chainlink Data Streams feed IDs, kept for the production path |
| `GET /public/corporate-actions/upcoming` | Warn users before a split or dividend changes the multiplier |

Live values (Sept 14, 2026, mainnet):

| Symbol | Solana mint | Pyth Hermes ID (reference) | Multiplier | Indicative price |
|---|---|---|---|---|
| NVDAx | `Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh` | `4244d07890e4610f46bbde67de8f43a4bf8b569eebe904f136b469f148503b7f` | 1.001701 | $211.96 |
| SPYx | `XsoCS1TfEyfFhfvj8EtZ528L3CaKBDBRqRapnBbDF2W` | `2817b78438c769357182c04346fddaad1178c82f4048828fe0997c3c64624e14` | 1.005715 | $761.76 |
| TSLAx | `XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB` | `47a156470288850a440df3a6ce85a55917b813a19bb5b31128a33a986566a362` | 1.000000 | $363.36 |

Trading mode is `TwentyFourFive` (24/5), so prices keep updating outside NYSE hours on weekdays. That shrinks the closed-market problem to weekends and holidays.

### ⚠️ Program change: xStocks are Token-2022 with a multiplier
- Solana xStocks use the **Token-2022 Scaled UI Amount extension**. The on-chain raw balance never changes; the real equity amount is `raw × multiplier`, and the multiplier lives on the mint.
- **If the program values `raw × price`, every xStock with a multiplier above 1 is undervalued, and one with a reverse split is overvalued (unsafe).**
- Required:
  1. Use `anchor_spl::token_interface` (`InterfaceAccount<Mint>`, `InterfaceAccount<TokenAccount>`, `Interface<TokenInterface>`) and `transfer_checked` for collateral, so both Token and Token-2022 mints work.
  2. In `oracle.rs`/`math.rs`, read the Scaled UI Amount extension from the collateral mint (current multiplier, plus the new multiplier once its activation timestamp has passed) and value collateral as `raw × multiplier × price × (1 − haircut)`.
  3. Before relying on it, confirm whether each price source is per token or per underlying share: compare xStocks `price-data.quote`, Jupiter `usdPrice` and NVDA × multiplier. Record the answer in parameters.md.
  4. Devnet mock equity mints must be **Token-2022 with the Scaled UI Amount extension** (NVDAx multiplier 1.001701, SPYx 1.005715) so the demo exercises the same path.
- Off-chain guards (server cron or on-demand in the app): halt → set the market to borrow-paused; proof of reserves shortfall → paused.

## Backpack: details

Docs: docs.backpack.exchange. Base URL `https://api.backpack.exchange/api/v1`. Public endpoints need no auth; account endpoints are ED25519-signed (see contracts/api.md).

Backpack matters in two ways:
1. **SPCX is real on-chain collateral.** It's a Token-2022 SPL token on Solana that can be deposited to and withdrawn from Backpack, so users can move it into their own wallet and lock it in StockCard.
2. **Broker-held stocks (MU.US, SNDK.US, …) are not.** They're Backpack Securities entitlements with no token, so they only show up in the import screen as "Not on-chain".

| Endpoint | Auth | Use in StockCard |
|---|---|---|
| `GET /assets` | none | SPCX Solana mint, decimals, deposit/withdraw enabled, withdrawal fee |
| `GET /markets` | none | Stock markets (`rwaMarketType: "STOCK"`), e.g. `SPCX.US_USDC` spot and `SPCX.US_USDC_PERP` |
| `GET /ticker?symbol=SPCX.US_USDC` (`&source=External`) | none | Backpack last price vs external market price, price signer source for SPCX (with Jupiter) |
| `GET /markPrices?symbol=SPCX.US_USDC_PERP` | none | Index and mark price, a second reference |
| `GET /depth?symbol=SPCX.US_USDC` | none | Order book depth, used to size liquidation haircut |
| `GET /collateral` | none | Backpack's own collateral haircut functions (useful benchmark) |
| `GET /securities`, `/market-sessions`, `/market-holidays` | none | Tradable stocks and session calendar, which can drive the closed-market oracle rules |
| `GET /capital` (`balanceQuery`) | signed | User's balances for the import screen (P3) |
| `GET /capital/collateral` (`collateralQuery`) | signed | User's Backpack margin view (optional compare) |
| `POST /wapi/v1/capital/withdrawals` (`withdraw`) | signed | **Not used.** We send users to the Backpack app to withdraw SPCX, never touching withdrawal permissions |

Live values (Sept 14, 2026):

| Field | Value |
|---|---|
| SPCX Solana mint | `SPCXxcqXj6e5dJDVNovHN8744zkbhM2bYudU45BimGb` (Token-2022, **6 decimals**, "SpaceX - Backpack Securities") |
| Deposit / withdraw on Solana | enabled / enabled, withdrawal fee 0.004 SPCX |
| Pyth feed | `8a593d6edde7a3095213c88116d8840d01e93c2ddeb800bc891772eb8b93bb94` (`Equity.US.SPCX/USD`, regular hours 09:30–16:00 ET) |
| External market price | $150.77 (Backpack ticker, source=External) |
| Backpack spot book | last $148.16, 24h volume ~84 SPCX (~$12k); top-of-book depth a few shares per level |
| Backpack perp | mark $150.82, index $150.83 |
| Backpack's own collateral haircut | `inverseSqrt` with base 0.5 (same as MU.US, SNDK.US) |

**Implications**
- SPCX uses the price signer (Backpack External + Jupiter). A Pyth feed exists but equity access is paid.
- On-chain SPCX liquidity is thin (Backpack spot ~$12k per day), so a liquidator can't dump size. Keep 50% max LTV but add a **10% haircut**, and cap total SPCX deposits (MVP: $250k market cap parameter).
- Pyth's SPCX feed (reference) only covers regular hours (Backpack itself trades pre/post/overnight sessions), so the closed-market rules apply every night, not just weekends.

## ⚠️ Issuer controls on real RWA mints (xStocks and SPCX)

Mainnet mint inspection (Sept 14) shows every real stock token we'd accept has these Token-2022 extensions:

| Extension | NVDAx / SPYx / TSLAx | SPCX | Risk for StockCard |
|---|---|---|---|
| Decimals | **8** | **6** | Mock mints must match; never assume 6 |
| `scaledUiAmountConfig` | multiplier 1.0009 → **newMultiplier 1.0017 effective 1789000200** (already live) | multiplier 1 | Value = raw × effective multiplier |
| `permanentDelegate` | issuer key | issuer key | Issuer can **move tokens out of our vault** (e.g. legal clawback). Vault balance can drop below `market.total_collateral` |
| `pausableConfig` | not paused | not paused | Issuer can **pause all transfers** → withdrawals and liquidations fail |
| Freeze authority | set | set | Issuer can **freeze our vault token account** |
| `transferHook` | authority set, program **none** | authority set, program **none** | A hook can be switched on later, and then plain transfers without extra accounts fail |
| `confidentialTransferMint` | configured, auto-approve off | same | No impact unless we opt in |
| `defaultAccountState` | initialized | initialized | Fine today; could change to frozen-by-default |

**Required program behavior** (added to tasks):
1. Reconcile: before valuing a market, read the vault's real token balance; if it's below `total_collateral`, mark the market `impaired` and block borrows.
2. Check the mint's `paused` flag and the vault account's frozen state in borrow/withdraw/liquidate; if paused or frozen, block borrows and show "Issuer paused transfers".
3. Transfer hook: if `transferHook.programId` becomes set, block the market until hook-aware transfers (extra account metas) are supported.
4. `add_market` stores which extensions were present; `update_market` can refresh them.
5. Disclose this in the UI and README: "Token issuers can pause, freeze or claw back tokens under their terms."

## Collector Crypt: details

Docs: docs.collectorcrypt.com. Base URLs: production `https://api.collectorcrypt.com`, devnet `https://dev-api.collectorcrypt.com`. Always send a non-empty `User-Agent`. An API key (`Authorization: Bearer ccsk_…`, request from support@collectorcrypt.com) only raises rate limits.

| Endpoint | Use in StockCard |
|---|---|
| `GET /cards/publicNft/:mint` | `insuredValue` (string, USD), `grade`, `gradeNum`, `gradingCompany`, `gradingID` (cert), `nftStandard`, `category`, `population`, images → **price signer input** and asset detail screen |
| `GET /cards/publicNft/:mint/market` | Owner, active listings, `status`, `inSwap`, `burnedForBridge` → reject collateral that is listed, in a swap, burned or redeemed |
| `GET /marketplace?ownerAddress=<wallet>` | Show a user's eligible Collector Crypt cards on the Assets screen |
| `POST /` `{"method":"getCardOffers","params":{"nftAddress","useV2":true}}` | Best live bid → liquidation value estimate |
| `POST /marketplace/list`, `/accept-offer`, `/broadcast` | **Liquidation path**: the liquidator lists the seized card or accepts the best offer (build → sign → broadcast) |

Rate limits: 300/min per dispatched method, 60/min broadcasts, anonymous allowance shared per network.

Gacha buyback (85% of insured value in the docs example, capped at $40k) only works on cards **won from a pack within 72 hours**, so it is **not** a general liquidation route. Shipping/redeem needs partner registration and burns the NFT; collateral must be locked so it can't be redeemed while pledged.

### ⚠️ Program change: NFT standards
Collector Crypt cards come as `Pnft`, `Cnft` (compressed), `StandardNft` or `CoreNft`. Only a standard NFT can sit in a normal token-account vault.
- **MVP**: support `StandardNft` only for the PSA10 demo market (our mock item mint), which is what the spec already does.
- **Post-MVP**: add escrow per standard: pNFT via Token Metadata transfer to a program-owned PDA; Core via `mpl-core` transfer (or freeze with a plugin); cNFT via Bubblegum transfer to a PDA owner (needs proofs from a DAS RPC such as Helius). Price with `insuredValue × (1 − 25%)` at 40% LTV (parameters.md), refreshed daily by the price signer, and use `GET …/market` to reject listed or in-swap items.

## PSA: details
- `GET https://api.psacard.com/publicapi/cert/GetByCertNumber/{cert}`, header `Authorization: bearer <token>` (token from a PSA account). Success when `IsValidRequest: true`.
- Free tier: **100 calls/day**. Terms limit use to confirming data for certified items. So call once per new collateral item, cache the result with the item, and don't bulk-query.
- Use: cross-check the `gradingID`/grade from Collector Crypt metadata (or a Phygitals NFT's on-chain metadata) before accepting a card as collateral.

## Phygitals, Beezie, ALT: what we can do without APIs
- **Phygitals**: cards are Solana NFTs whose on-chain metadata includes grading company, cert number and grade. We can read ownership and metadata through any Solana RPC/DAS and verify the cert with PSA, **but there's no FMV feed**, so prices would need a Phygitals partnership or a third-party source. They also run their **own custodial pawn loans** (7-day at 5% flat, 30-day at 12% flat, graded vaulted cards only) and an 85% FMV pack buyback.
- **Beezie**: no developer docs. Watches arrive with The Luxury Closet at the end of 2026. Partnership ask: FMV feed + buyback/SWAP access for liquidations.
- **ALT**: runs card lending (alt.xyz/borrow) and publishes "Alt Value" FMV. No public API docs; Beezie reportedly uses its FMV. Partnership or data-licensing ask.

## Positioning note
Phygitals and ALT already lend against cards, but custodially, per platform, with short fixed terms and no card. StockCard's pitch to them: "keep your pawn book, and let your users open a card credit line with the same cards; liquidations flow back to your marketplace."

## Sources
- xStocks: docs.xstocks.fi (developers/quickstart, developers/multipliers, apis/openapi), live calls to api.backed.fi on Sept 14, 2026
- Backpack: docs.backpack.exchange; live calls to api.backpack.exchange on Sept 14, 2026; mint inspection via Solana mainnet RPC
- Collector Crypt: docs.collectorcrypt.com (marketplace/api, gacha/api, vault/shipping-api)
- PSA: psacard.com/publicapi/documentation; cardgrader.ai/blog/psa-api
- Phygitals: docs.phygitals.com (technology-overview, pawn-lending-terms, pack-opening-and-buyback)
- Beezie: docs.beezie.com/llms.txt
- WatchCharts: watchcharts.com/api
- ALT: support.alt.xyz (Alt Value), alt.xyz/borrow
- Jupiter: developers.jup.ag, portal.jup.ag


## Oracle update (Sept 14, 2026)
Hybrid plan, details in parameters.md "Oracle decision": price signer for all equities from Tuesday; Switchboard spike Wednesday 09:00–11:00 ET with go/no-go at 12:00 for SPYx/TSLAx; NVDAx, TIDE and PSA10 stay Signed; Chainlink Data Streams is the production path. Sources: docs.chain.link/data-streams/sign-up (pricing), docs.switchboard.xyz (devnet support), live calls to api.backed.fi and lite-api.jup.ag on Sept 14.
