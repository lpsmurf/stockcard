# StockCard demo video script (2–3 minutes)

Live URL: https://demo.stockcard.clawdrop.live — Solana **devnet** only. Everything you show is a real on-chain transaction; the card, payout and shop are labelled mocks.

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

4. **Pre-IPO collateral** (1:10–1:30) — the bounty beat
   - In the Shop Stocks tab, buy $50 of T-OPENAI (Tessera) or PRE-SPACEX (PreStocks).
   - Open its Asset detail: show the "Pre-IPO" chip, the "Trading X% below NAV — we lend against the lower figure" line (live provider data), and the price sources row.
   - Deposit it and point out the tighter 30% max LTV / 11.9–15.9% APR bands in the Borrow sheet.

5. **Card** (1:30–1:55)
   - Create a mock Visa card, set a spending limit (SPL approve).
   - "Test purchase" → coffee preset → show the settled transaction in the feed.
   - Point out the cashback queued row.

6. **Cashback** (1:55–2:05)
   - Show the cashback row flipping from queued → deposited as more NVDAx collateral.

7. **Bank** (2:05–2:30)
   - Add a SEPA IBAN (e.g. `NL91ABNA0417164300`).
   - Get a quote, send the USDC transfer, show "Simulated SEPA payout" processing → arrived.
   - Mention the real USDC transfer on-chain; the bank leg is mocked.

8. **Portfolio / Admin** (2:30–2:55, optional)
   - Show the portfolio breakdown and the admin "crash price" demo (market −30%) → alert banner / push.
   - Close on "self-custody: your collateral stays in your vault."

Keep the `MockBadge` visible whenever you mention card/payout/art assets.
