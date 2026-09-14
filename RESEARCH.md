# Research notes (Sept 14, 2026)

## Backpack
- Backpack Securities holds real US stocks/ETFs as **broker security entitlements, not SPL tokens**. They can't be withdrawn to a Solana wallet, so they can't be locked in our program.
- Since **Sept 1, 2026**, Backpack lets users post MU and SNDK shares as collateral for perps, spot margin, or **borrowing USD**. That runs inside the CEX, with no card.
- **SPCX** (SpaceX) is an actual SPL token issued by Backpack Securities. It's 1:1 backed, redeemable via ACATS/DTCC, and has more than 10k holders. It's eligible as collateral for us.
- Exchange API: ED25519-signed REST + WS (`X-API-Key`, `X-Signature`, `X-Timestamp`, `X-Window`). Docs: https://docs.backpack.exchange/
- Our plan: an on-chain vault for SPL stocks, plus a read-only "Import from Backpack" view that shows which holdings are eligible and prompts the user to withdraw SPCX to their wallet.

## Tokenized stock lending on Solana (competition)
| Project | What | Gap vs us |
|---|---|---|
| Kamino Lend | 82.6% share of tokenized-stock lending; accepts xStocks as collateral | DeFi money market UI, no card |
| Jupiter Lend | #2 xStock lending venue | Same |
| Backpack borrow | USD against MU/SNDK inside CEX | Custodial, 2 tickers, no card |
| Kraken Pro | xStocks as margin collateral | CEX, trading-focused |
| ether.fi Cash (Borrow Mode) | Borrow on a card against collateral (Aave V4), ~70k cardholders, ~$22M borrowed | Optimism, crypto collateral only |
| Nexo | CeFi credit line + card | Crypto collateral, custodial |

Tokenized-stock lending TVL on Solana is about **$23M**, so the category is early. xStocks are about 86.5% of tokenized-equity issuance on Solana.

**Wedge:** no one offers a stock-collateral credit card on Solana.

## Card issuers
| Provider | Solana | Access | Notes |
|---|---|---|---|
| **Bridge (Stripe) + Stripe Issuing** | Yes, non-custodial USDC | Public sandbox with **Solana devnet** | Hackathon pick. Devnet USDC mint `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`, MERCHANT_ID 1. Card created with `crypto_wallet{chain:"solana",currency:"usdc",type:"standard",address}` |
| Rain | Yes (Avici, Tria, Solayer, Plasma One) | Sales-led | Supports collateral/credit cards. **Solana program exploited Aug 28, 2026** (sig-verification bypass, ~$0.9M documented + ~$1.1M undisclosed, refunded). Upgrade authority moved to Squads on Sept 5 |
| Baanx (acquired by Exodus) | Yes | Sales-led | Offers borrow-against-assets products |
| Gnosis Pay | No (Gnosis Chain) | White-label | EVM only |
| Immersve / Reap | Partial | Sales-led | Secondary |
| Kulipa | — | **Wound down July 2026** | Solflare Card paused |

Takeaway: build the demo on Bridge sandbox, and pitch the card layer as issuer-agnostic, with Rain/Baanx as production options. Collateral stays in our program, not the issuer's, which is a direct answer to the Rain exploit.

## Hackathon
- $100k prize pool (Solana Foundation). At the time of research: 371 registered, 34 submissions.
- Judges ask: "could this be a real app that people will actually use?" They want real user need, a working end-to-end prototype, Solana relevance, and execution.
- Required: at least one link (GitHub, demo, or video), original work, one submission per team.
- Colosseum Copilot search was skipped because no token was available. To run it later, get a PAT at arena.colosseum.org/copilot.

## Sources
- https://hackathons.solana.com/hackathons/stocklana
- https://solanacompass.com/news/backpack-exchange-launches-four-equity-perpetuals-and-real-us-shares-as-cross-asset-collateral
- https://thedefiant.io/converge/defi/backpack-s-tokenized-spacex-token-on-solana-crosses-10-000-holders-nearly-double-xstocks-spcxx
- https://support.backpack.exchange/exchange/backpack-securities/faqs
- https://solanacompass.com/news/solana-tokenized-stock-lending-tvl-reaches-231m-kamino-finance-controls-826-of-venue-share
- https://thedefiant.io/news/defi/kamino-becomes-first-major-defi-lender-to-accept-tokenized-stocks-as-collateral
- https://defiprime.com/crypto-cards-who-holds-the-money
- https://www.fintechwrapup.com/p/deep-dive-the-2026-directory-of-stablecoin
- https://apidocs.bridge.xyz/platform/cards/sandbox/sandbox
- https://docs.stripe.com/issuing/bridge-stablecoin-cards
- https://www.spendnode.io/crypto-cards/solflare-card/
