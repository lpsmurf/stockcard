# Contract: app route handlers (`app/src/app/api`)

All routes return `{ ok: true, data }` or `{ ok: false, error: { code, message } }`. Requests that change state for a wallet must include `x-wallet`, `x-signature` (ed25519 signature over `stockcard:{route}:{timestamp}`) and `x-timestamp` (≤ 5 minutes old), verified server-side. Demo admin routes also require `ADMIN_TOKEN`.

| Method & path | Body | Response data | Notes |
|---|---|---|---|
| `POST /api/faucet` | none | `{ signature, amount }` | Test money: 100,000 dUSDC once per wallet, then ≤ 10,000 per 24 h |
| `GET /api/shop/items` | none | `[{ symbol, kind, name, grade?, image, priceUsd6, source }]` | Stocks at signed price, TIDE, six mirrored items (cached 60 s) |
| `POST /api/shop/buy` | `{ symbol, amount, paySignature }` | `ShopOrder` | Wallet-signed. Verifies the dUSDC transfer to `SHOP_TREASURY_ADDRESS` (amount = price × qty), then mints the mock token; idempotent by `paySignature` |
| `POST /api/card` | `{ holderName, network }` | `Card` | Creates via the active CardProvider |
| `GET /api/card` | none | `Card \| null` + `{ allowanceUsd6 }` | Reads delegate allowance on-chain |
| `PATCH /api/card` | `{ status?, tier?, cashbackMint? }` | `Card` | `cashbackMint` must be an allowed market mint |
| `POST /api/card/simulate` | `{ merchant, category, amountUsd6 }` | `CardTransaction` | Declines on low allowance/balance; on settle enqueues cashback |
| `GET /api/card/transactions` | none | `CardTransaction[]` | Newest first |
| `POST /api/cashback/process` | `{ txId }` | `CardTransaction` | Idempotent; also called inline after settle |
| `POST /api/backpack/import` | `{ apiKey, timestamp, window, signature } \| { demo: true }` | `{ holdings: [{ symbol, qty, eligible, reason }] }` | **Secret never sent.** Client signs `instruction=balanceQuery&timestamp=<ms>&window=<ms>` (ED25519, base64). Server forwards `GET https://api.backpack.exchange/api/v1/capital` with `X-API-Key`, `X-Signature`, `X-Timestamp`, `X-Window` within the window (≤ 60,000 ms). Nothing is logged or stored. |
| `POST /api/admin/price` | `{ mint, price }` or `{ mint, action: "crash" \| "restore" }` | `{ signature }` | Devnet only (`NEXT_PUBLIC_CLUSTER=devnet`) |
| `POST /api/admin/liquidate` | `{ owner, mint, repayUsd6 }` | `{ signature }` | Uses the admin keypair as liquidator |
| `POST /api/push/subscribe` | `{ subscription: PushSubscriptionJSON }` | `{ id }` | Wallet-signed. Stores the device under `push:{owner}` |
| `DELETE /api/push/subscribe` | `{ endpoint }` | `{ removed: true }` | Wallet-signed |
| `POST /api/push/test` | none | `{ sent }` | Wallet-signed. Sends "Notifications are on" to the caller's devices |
| `POST /api/prices/sync` | none | `{ posted: [{ symbol, price, sig }], skipped: [{ symbol, reason }] }` | Header `authorization: Bearer CRON_SECRET`. Price signer (parameters.md "Price signer"); skips markets under a `Demo` override |
| `POST /api/alerts/check` | `{ owner? }` | `{ checked, notified }` | Header `authorization: Bearer CRON_SECRET`. Reads positions + prices, computes bands, sends pushes per parameters.md §4. Also called inline by `/api/admin/price` after a price change |

**Web push notes**
- VAPID keys: `NEXT_PUBLIC_VAPID_PUBLIC_KEY` for `pushManager.subscribe`, `VAPID_PRIVATE_KEY` + `VAPID_SUBJECT` server-side via `web-push`.
- The service worker (`public/sw.js`, T042) handles `push` (show notification with title/body from the payload) and `notificationclick` (open `/?fix={market}`, which opens the Add collateral or Repay sheet prefilled).
- Payload: `{ title, body, market, band, url }` only. No other users' data, no secrets.
- Permission is requested only after a user taps "Turn on alerts" (Home banner or Card screen), never on page load.
- Schedule: Upstash QStash every 5 minutes (Vercel Hobby cron is daily only).

**Backpack notes** (from docs.backpack.exchange, checked Sept 14, 2026)
- Auth: ED25519. Headers `X-API-Key` (base64 public key), `X-Signature` (base64), `X-Timestamp` (ms), `X-Window` (default 5000, max 60000). Signing string: `instruction=<type>&<params sorted alphabetically as query string>&timestamp=<ts>&window=<window>`.
- Balances: `GET /api/v1/capital` (instruction `balanceQuery`) → `{ [symbol]: { available, locked, staked } }`.
- Backpack's own margin view: `GET /api/v1/capital/collateral` (`collateralQuery`) → per-asset `collateralWeight`, `collateralValue`. Useful to show "Backpack margin vs StockCard credit" (optional).
- Public: `GET /api/v1/securities` (asset, name, CUSIP, sessions), `GET /api/v1/markets` (`rwaMarketType: "STOCK"`, e.g. `MU.US_USDC`), `GET /api/v1/market-sessions`, `GET /api/v1/market-holidays`. The session and holiday feeds can drive our closed-market oracle haircut too.
- Stock symbols use a `.US` suffix (e.g. `SPCX.US`). Eligibility map: strip `.US`; `SPCX` → eligible (SPL token); others → "Not on-chain" unless an xStocks equivalent exists (show "Buy NVDAx instead").
- The docs don't describe read-only key scopes, so we never accept the secret server-side. We never call `withdraw`; the CTA sends users to the Backpack app.

**CardProvider interface** (`app/src/lib/card/provider.ts`)
```ts
export interface CardProvider {
  name: "mock" | "bridge";
  createCard(input: { owner: string; holderName: string; network: "VISA" | "MASTERCARD" }): Promise<Card>;
  getCard(owner: string): Promise<Card | null>;
  simulatePurchase(input: { owner: string; merchant: string; category: string; amountUsd6: bigint }): Promise<CardTransaction>;
  listTransactions(owner: string): Promise<CardTransaction[]>;
}
```

**Server env** (never `NEXT_PUBLIC_`): `CARD_AUTHORITY_SECRET`, `CASHBACK_AUTHORITY_SECRET`, `FAUCET_AUTHORITY_SECRET`, `ADMIN_SECRET`, `ADMIN_TOKEN`, `BRIDGE_API_KEY`, `STRIPE_SECRET_KEY`, `KV_REST_API_URL`, `KV_REST_API_TOKEN`, `MERCHANT_SETTLEMENT_ADDRESS`.
