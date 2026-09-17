# StockCard demo video script (2–3 minutes)

Live URL: https://stockcard-app.vercel.app — Solana **devnet** only. Everything you show is a real on-chain transaction; the card, payout and shop are labelled mocks.

Before recording, run `./scripts/demo-price-loop.sh` in a terminal so signed prices stay fresh (equities go stale after 3 minutes while the market is open). Keep it running for the whole demo.

Suggested flow (record on desktop Chrome or Android Chrome with Phantom/Solflare):

1. **Home** (0:00–0:20)
   - Show "Spend what you own. Never sell it."
   - Point out the `Prices · N min ago` chip and `Devnet mock` badge.

2. **Shop** (0:20–0:40)
   - "Claim test money" (devnet dUSDC faucet) — show the explorer toast.
   - Buy $50 of NVDAx — show the confirmed payment and mint transactions.

3. **Borrow** (0:40–1:10)
   - Deposit the NVDAx as collateral.
   - Show the credit line, LTV, liquidation price and APR.
   - Borrow dUSDC — show the on-chain tx.

4. **Card** (1:10–1:40)
   - Create a mock Visa card, set a spending limit (SPL approve).
   - "Test purchase" → coffee preset → show the settled transaction in the feed.
   - Point out the cashback queued row.

5. **Cashback** (1:40–1:55)
   - Show the cashback row flipping from queued → deposited as more NVDAx collateral.

6. **Bank** (1:55–2:20)
   - Add a SEPA IBAN (e.g. `NL91ABNA0417164300`).
   - Get a quote, send the USDC transfer, show "Simulated SEPA payout" processing → arrived.
   - Mention the real USDC transfer on-chain; the bank leg is mocked.

7. **Portfolio / Admin** (2:20–2:45, optional)
   - Show the portfolio breakdown and the admin "crash price" demo (market −30%) → alert banner / push.
   - Close on "self-custody: your collateral stays in your vault."

Keep the `MockBadge` visible whenever you mention card/payout/art assets.
