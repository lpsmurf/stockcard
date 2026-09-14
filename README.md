# StockCard

A credit card backed by your stocks, on Solana. You lock tokenized US stocks (xStocks, or Backpack's SPCX) in an on-chain vault, borrow USDC up to a max LTV at a fixed APR, and spend it with a Visa/Mastercard. Repay whenever you want, then withdraw your stock. Think Nexo, but for equities, self-custodial, on Solana.

- **Hackathon:** [Stocklana](https://hackathons.solana.com/hackathons/stocklana). Track: Credit & yield + Consumer
- **Deadline:** Fri Sept 18, 2026, 4:00 PM ET
- **Stack:** Anchor program (devnet) + Next.js app + stock prices from a price signer (xStocks + Jupiter), Switchboard spike, Chainlink as production path + Bridge/Stripe card sandbox

## Status
Planning done, no code yet. See:
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
First task: request Bridge sandbox access (apidocs.bridge.xyz). Then scaffold the Anchor program and the Next.js app.

Commit as `littleplu@gmail.com`. Vercel deploys break with other author emails.
