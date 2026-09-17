# StockCard

A credit card backed by your stocks, on Solana. You lock tokenized US stocks (xStocks, or Backpack's SPCX) in an on-chain vault, borrow USDC up to a max LTV at a fixed APR, and spend it with a Visa/Mastercard. Repay whenever you want, then withdraw your stock. Think Nexo, but for equities, self-custodial, on Solana.

- **Hackathon:** [Stocklana](https://hackathons.solana.com/hackathons/stocklana). Track: Credit & yield + Consumer
- **Deadline:** Fri Sept 18, 2026, 4:00 PM ET
- **Stack:** Anchor program (devnet) + Next.js app + stock prices from a price signer (xStocks + Jupiter), Switchboard spike, Chainlink as production path + Bridge/Stripe card sandbox

## Live demo

- **App:** https://stockcard-app.vercel.app (Solana devnet only)
- **Program ID:** `HsXyxfSvp7mha6bxgh3Qr9NoVmMVe6HmynVguRfBLWrY`
- **Status:** Deployed Sept 17. Card and bank payout are mock providers; prices are signed on-chain by the app's price signer; cashback and shop flows use mock devnet USDC. No real KYC, card issuer, SEPA rail, or partner integrations.

Quick demo path (devnet): connect wallet → buy mock assets in the Shop → deposit on Borrow → borrow dUSDC → spend on Card → Send to bank (simulated SEPA) → Portfolio/Cashback/Savings. Screenshots are in [`docs/screenshots/`](docs/screenshots/); a suggested demo script is in [`docs/demo-script.md`](docs/demo-script.md).

Persistence: off-chain records (card transactions, payouts, push subscriptions, price history) use `src/lib/kv.ts`. Production is currently backed by a secret GitHub Gist (`KV_GIST_ID`/`KV_GITHUB_TOKEN`) because Upstash `*.upstash.io` endpoints were unreachable from the deploy network; Upstash `KV_REST_API_URL`/`KV_REST_API_TOKEN` remain supported and preferred when available.

Scheduled jobs: `.github/workflows/cron.yml` calls `POST /api/prices/sync` and `/api/alerts/check` every 5 minutes (GitHub Actions minimum; Vercel hobby plan does not allow sub-daily cron). `QSTASH_TOKEN` is already supported for a 60-second Upstash QStash schedule when credentials are available.

End-to-end check: `cd app && node scripts/e2e-api.mjs` funds a fresh devnet wallet, claims the faucet, approves the card delegate, runs a simulated SEPA payout, buys NVDAx in the shop, creates a mock card and settles a test purchase against the deployed API.

Before recording the demo, run `./scripts/demo-price-loop.sh` to keep signed prices fresh (equities go stale after 3 minutes while the market is open).

## Status
The Anchor program and core demo app are implemented. For the September 17 continuation snapshot, remaining work, verification results, and local changes that may not yet be on GitHub, read [HANDOFF_DEVIN.md](HANDOFF_DEVIN.md). See also:
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
