# StockCard

A credit card backed by your stocks, on Solana. You lock tokenized US stocks (xStocks, or Backpack's SPCX) in an on-chain vault, borrow USDC up to a max LTV at a fixed APR, and spend it with a Visa/Mastercard. Repay whenever you want, then withdraw your stock. Think Nexo, but for equities, self-custodial, on Solana.

- **Hackathon:** [Stocklana](https://hackathons.solana.com/hackathons/stocklana). Track: Credit & yield + Consumer
- **Deadline:** Fri Sept 25, 2026, 4:00 PM ET — main track plus Pyth, Tessera and PreStocks bounties
- **Stack:** Anchor program (devnet) + Next.js app + stock prices from a price signer (xStocks + Jupiter), Switchboard spike, Chainlink as production path + Bridge/Stripe card sandbox

## Live demo

- **App:** https://demo.stockcard.hfsp.cloud (Solana devnet only) — mirror: https://stockcard-app.vercel.app
- **Program ID:** `HsXyxfSvp7mha6bxgh3Qr9NoVmMVe6HmynVguRfBLWrY`
- **Status:** Deployed Sept 17. Card and bank payout are mock providers; prices are signed on-chain by the app's price signer; cashback and shop flows use mock devnet USDC. No real KYC, card issuer, SEPA rail, or partner integrations.

Quick demo path (devnet): connect wallet → buy mock assets in the Shop → deposit on Borrow → borrow dUSDC → spend on Card → Send to bank (simulated SEPA) → Portfolio/Cashback/Savings. Screenshots are in [`docs/screenshots/`](docs/screenshots/); a suggested demo script is in [`docs/demo-script.md`](docs/demo-script.md).

Persistence: off-chain records (card transactions, payouts, push subscriptions, price history) use `src/lib/kv.ts`. Production is currently backed by a secret GitHub Gist (`KV_GIST_ID`/`KV_GITHUB_TOKEN`) because Upstash `*.upstash.io` endpoints were unreachable from the deploy network; Upstash `KV_REST_API_URL`/`KV_REST_API_TOKEN` remain supported and preferred when available.

Scheduled jobs: `.github/workflows/cron.yml` calls `POST /api/prices/sync` and `/api/alerts/check` every 5 minutes (GitHub Actions minimum; Vercel hobby plan does not allow sub-daily cron). `QSTASH_TOKEN` is already supported for a 60-second Upstash QStash schedule when credentials are available.

End-to-end check: `cd app && node scripts/e2e-api.mjs` funds a fresh devnet wallet, claims the faucet, approves the card delegate, runs a simulated SEPA payout, buys NVDAx in the shop, creates a mock card and settles a test purchase against the deployed API.

Before recording the demo, run `./scripts/demo-price-loop.sh` to keep signed prices fresh (equities go stale after 3 minutes while the market is open).

## Architecture

```
Wallet (PWA / Android APK) ──► Next.js app (UI + API routes) ──► Anchor program on devnet
                                     │                                │
                                     ├─ price signer (xStocks+Jupiter)├─ Config / Market / Position PDAs
                                     ├─ card + payout mock providers  ├─ USDC pool (borrow/repay/liquidate)
                                     └─ KV store (txs, payouts, push) └─ Token-2022 collateral vaults
```

Collateral safety lives in the program: every borrow/withdraw/liquidate re-checks LTV against a staleness-passing signed price in the same instruction. The client only previews.

## Risk parameters (devnet)

- Listed equities: max LTV 50%, liquidation threshold 65%, liquidation bonus 5%, haircut 0%
- Pre-IPO (SPCX etc.): max LTV 30%, threshold 45%, bonus 8%, haircut 25%; SPCX deposit cap $250k
- Collectibles / art notes: max LTV 40%, threshold 55%, bonus 8%, haircut 25%
- APR bands by LTV (stocks): ≤20% → 9.9%, 20–35% → 12.9%, 35–50% → 14.9%; pre-IPO/collectibles ≤20% → 11.9%, ≤30% → 15.9%; founding-member −2 pt is an off-chain preview
- Liquidation close factor: 50% of debt per call; interest accrues per-second, rounded in the protocol's favor

Full table: [`specs/001-stockcard-mvp/parameters.md`](specs/001-stockcard-mvp/parameters.md).

## What's mocked

- Card issuer and spend (`mock` provider behind the `CardProvider` interface; Bridge only when `BRIDGE_API_KEY` is set)
- SEPA bank payouts (simulated status rows, no real rail), ECB rate for the EUR quote
- Prices: signed on-chain by the app's price signer (xStocks + Jupiter public APIs); no production oracle
- Shop assets: mock Token-2022 mints on devnet bought with faucet dUSDC; collectible listings mirrored from Collector Crypt, not affiliated
- No KYC, no mainnet assets, no real partnerships

## Run it

```bash
anchor build --arch v2 && anchor deploy --provider.cluster devnet
./scripts/sync-idl.sh
npx tsx scripts/seed-devnet.ts          # mock mints, markets, prices, pool
cd app && npm install && npm run dev    # http://localhost:3000
```

Program tests: `scripts/validator.sh &` then `anchor test --skip-build --skip-local-validator --provider.cluster localnet`.

Android APK: wrap the deployed PWA with `npx solana-mobile webshell init && npx solana-mobile webshell build` (JDK 17 + Android SDK); wallets connect via Mobile Wallet Adapter.

## Status
The Anchor program and core demo app are implemented. See also:
- [PLAN.md](PLAN.md): scope, architecture, 4-day schedule, verification
- [RESEARCH.md](RESEARCH.md): competitors, card issuers, Backpack findings, sources

## Layout
```
programs/stockcard/   Anchor program (credit-line vault)
app/                  Next.js frontend + API routes (card, backpack)
scripts/              devnet seeding (mock stock mints, markets, USDC pool)
tests/                anchor tests
```

## Continue on another machine
```bash
gh repo clone lpsmurf/stockcard
cd stockcard
cp .env.example .env
```
Before building, follow the handoff's restore and environment instructions: the local branch may contain commits and uncommitted work missing from a GitHub clone. The existing app is in `app/`; do not scaffold it again. The demo uses mock card and payout providers on devnet.

Commit as `littleplu@gmail.com`. Vercel deploys break with other author emails.
