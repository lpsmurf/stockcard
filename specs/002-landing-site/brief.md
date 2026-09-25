# Landing site brief: StockCard waitlist

**For**: Kimi Code (builder). **Owner**: Luis. **Status**: ready to build after Stocklana submission (the MVP in `specs/001-stockcard-mvp` comes first).
**Deploy**: Vercel, its own project. **Goal date**: live in week 2 of the 30-day plan (Sept 21–25).

This brief fixes the facts, the structure and the guardrails. The visual execution is deliberately left partly open: sections marked **Kimi's call** are yours to design. Surprise us inside the rules.

---

## 1. What the page must do

One job: **get qualified people onto the waitlist**, and get them to choose the asset they'd lock and the cashback asset they want.

Secondary jobs: explain the product in 10 seconds, make the tiers desirable (Revolut Ultra energy), and look credible enough that partners and investors can be sent the link.

**Primary CTA**: "Join the waitlist". **Secondary CTA**: "See how credit works" (scrolls to the calculator).

## 2. Audience, in priority order

1. Holders of tokenized stocks on Solana (xStocks, SPCX) who don't want to sell.
2. Graded-card and watch collectors whose items are already vaulted and tokenized on Solana.
3. Art-curious Web3 users in Amsterdam and the EU (Bart's community).
4. Partners and investors checking whether we're real.

Tone: calm, premium, direct. "Spend what you own. Never sell it." No crypto slang, no rocket emojis, no "degen". The thesis line from GTM: **real assets, not memecoins**.

## 3. Page structure

Order is a recommendation; merging or re-ordering sections is **Kimi's call** as long as every block exists.

| # | Section | Must contain | Inspiration |
|---|---|---|---|
| 1 | **Hero** | Headline "Spend what you own. Never sell it." · one-line subhead · waitlist email field + CTA · a hero card render (metal card) · trust line "Built on Solana · Devnet beta" | KAST hero, Nexo card hero |
| 2 | **Asset strip** | What you can lock: tokenized stocks, graded cards (incl. cards pulled from Solflare Packs), luxury watches, art notes. Open-licensed images first, Collector Crypt API images for "tokenized on Solana" examples (`assets.md`) | Marquee / carousel, **Kimi's call** |
| 3 | **How it works** | 3 steps: Lock → Borrow → Spend, plus "Repay anytime, take it back" | Nexo "how to" slider, Solflare sections |
| 4 | **Credit calculator** | Pick an asset type and value → shows credit line (LTV), liquidation price, the APR band for that LTV and daily interest. Uses the numbers in §5–§6 | Nexo credit mode explainer |
| 5 | **Cashback that buys assets** | "Every purchase buys you more of what you own." Example: groceries €62.15 at Plus 1.5% → +0.0044 NVDAx · "Highest cashback on spend up to a quarter of the credit you use" | KAST cashback block |
| 6 | **Membership tiers** | Standard / Plus / Black comparison with the benefits in §5, founding member offer | Revolut Ultra, KAST tiers table |
| 6b | **Savings** | "Earn ~6% on USDC", how savings fund credit lines, legal note | Nexo earn blocks |
| 6c | **How we compare** | Comparison table from §5 | **Kimi's call** on format (table, cards, toggle) |
| 6d | **Try the demo** | Link to the devnet app: claim test money, buy a stock, card or watch in the Demo Shop, lock it, spend | App screenshots or short loop video |
| 7 | **Protection** | Buffer, alerts before liquidation (web push), your collateral stays in an on-chain program, not with us | Solflare "Stronghold of Security" |
| 8 | **Real assets only** | The anti-memecoin manifesto, short. What we never accept | Editorial moment, **Kimi's call** |
| 9 | **FAQ** | At least the 11 questions in §8 | Accordion |
| 10 | **Final CTA + footer** | Waitlist again, socials, legal disclaimer from §9 | |

## 4. Waitlist mechanics

- Fields: email (required), "What would you lock?" (Stocks / Graded cards / Watches / Art / Not sure), "Cashback in" (NVDAx / SPYx / Art note / Not sure), optional Solana wallet address.
- After signup: position in queue, personal referral link, "Move up 10 spots per friend who joins". Referral reward from GTM: **Plus-tier cashback for your first 3 months**.
- Storage: Upstash Redis (same provider as the app). Keys: `waitlist:{email}`, `ref:{code}`, sorted set `queue`. Double opt-in email is optional (Resend) — if skipped, rate-limit by IP and reject disposable domains.
- No wallet connection required on the landing page.
- Vercel Analytics for page views; one event per step (view calculator, start signup, complete signup, share referral).

## 5. Membership tiers, rates, savings and founding offer

Source of truth: `specs/001-stockcard-mvp/parameters.md` §3b. Perks marked *planned* must sit under "Planned benefits" with the footnote "Benefits depend on partner and issuer agreements and may change." Don't invent more perks or numbers.

### Tiers
| | **Standard** | **Plus** | **Black** |
|---|---|---|---|
| Price | Free | €9.99/month · €99/year | €39.99/month · €399/year |
| Cashback, paid in the real asset you pick | 0.5% | 1.5% | **2.5%** |
| Top rate applies to spend up to | 25% of your credit in use, max €1,000/month (then 0.25%) | 25% of credit in use, max €2,000 (then 0.5%) | 25% of credit in use, max €4,000 (then 0.75%) |
| Credit APR (by LTV) | from 9.9% | from 8.9% (−1 pt) | from 9.9% |
| Savings APY | ~6% variable | +0.5 pt | +1 pt |
| Card | Virtual | Virtual + physical | Metal |
| Assets you can lock | Stocks, cards, watches, art notes | same | same |
| Alerts before liquidation | In-app + push | In-app + push | + SMS (planned) |
| Art drops | — | Early access | Priority allocation (planned) |
| Airport lounges | — | — | Card-network lounge program (planned) |
| Travel & purchase insurance | — | — | Included (planned) |
| Grading & vault credits | — | — | Included (planned) |
| FX markup | Card network rate | Card network rate | 0% (planned) |
| Fast Track security | — | — | 4 per year (planned) |
| Trip / event cancellation | — | — | Up to 70%, max €5,000/year (planned) |
| Global eSIM data | — | 1 pack/year (planned) | Monthly allowance (planned) |
| Subscriptions | — | — | Pick 2: Financial Times, Perplexity Pro, NordVPN, Headspace, MasterClass (planned) |

Safety rule: max LTV and liquidation terms never depend on tier.

### Rates: lower LTV, lower rate (Nexo-style)
| Borrowed against stocks | APR |
|---|---|
| up to 20% of value | 9.9% |
| 20–35% | 12.9% |
| 35–50% | 14.9% |
Cards, watches and art notes: 11.9% / 15.9%. Show this as an interactive element in the calculator.

### Savings
"Earn ~6% on USDC. Your savings fund the credit lines." Variable APY; show the formula in the FAQ, not the hero. Legal note under the section: "Savings is in development and not available in the EU until regulatory approval."

### Founding member offer (early adopters)
- **Founding APR**: −2 pt for 12 months on the first €5,000 of balance, for the first 1,000 waitlist members who activate within 90 days of launch.
- **Plus on us**: 3 months of Plus for every referral.
- **Founding saver**: +1 pt APY on your first $10,000 for 6 months.
- **Founders metal card**: numbered design for the first 250 Black members.
Show a live counter of remaining founding spots only if it's real (from the waitlist count); otherwise no counter.

### How we compare (use in a comparison section; keep "not checked" cells honest)
| | **StockCard** (proposed) | KAST | Nexo | Revolut Ultra | Crypto.com Visa | ether.fi Cash |
|---|---|---|---|---|---|---|
| Membership price | Free / €9.99 / €39.99 per month | Free / $1,000 per yr / $10,000 per yr | Free (tier = share of NEXO held) | €65/month (NL, Sept 2026) | Subscription $4.99–29.99/month or CRO lock-up | Free Core; paid tiers |
| Top cashback | **2.5% in the real asset you pick** (on spend up to 25% of credit in use) | 3% (Private tier) | Up to 2% in NEXO (0.5% in BTC) | Not the headline benefit | 2–5% in CRO with lock-ups (8% Prime) | 3% up to $2,000/month, paid in wETH |
| Borrow against | **Stocks, graded cards, watches, art** | — | Crypto | — | — | Crypto (Borrow Mode) |
| Borrow rate | 9.9–14.9% (from 8.9% with discounts) | — | 2.9%–18.9% by tier and LTV | — | — | Lending-market rate (not checked) |
| Earn on stablecoins | ~6% variable, funds loans | Earn product (rate not checked) | Up to 13% (by tier) | — | Not compared | Not compared |
| Custody of collateral | On-chain program | Not checked | Custodial | Bank | Custodial | Self-custodial (per its site) |

Footnote: "Competitor details from their public sites and reviews, September 2026. Check the provider for current terms."

## 6. Numbers the page may use

| Item | Value | Source |
|---|---|---|
| Max LTV | Stocks 50% · graded cards 40% · art notes 30% · watches 40% (proposed, same as collectibles) | parameters.md |
| APR | Stocks 9.9% / 12.9% / 14.9% by LTV; cards, watches, art 11.9% / 15.9%; discounts to 8.9% floor | parameters.md §3b |
| Savings APY | ~6% variable (60% of borrower interest) | parameters.md §3b |
| Liquidation threshold | Stocks 65% · cards 55% · art 45% | parameters.md |
| Suggested max | 35% LTV | parameters.md §4 |
| Calculator example | $10,000 of stock → $5,000 credit line; at $3,500 borrowed (35%) the stock can fall 46% before liquidation; APR 12.9% → $1.24/day; under $2,000 borrowed → 9.9% | derived |
| Cashback example | €62.15 groceries at Plus 1.5% → €0.93 → +0.0044 NVDAx at $211.96 | wireframes.md |
| Tokenized-equity volume on Solana | record $1.29B in one mid-June 2026 week, ~95% of all chains | solanafloor.com (June 2026 roundup) |

Anything not in this table: leave it out or ask Luis.

## 7. Design direction

### Mood
Fintech premium, dark-first, like **KAST** and **Nexo**: deep near-black grounds, cool greys, crisp white type, one confident accent, and cards rendered like physical metal objects. Solflare's section rhythm (big statement, product visual, short proof) is a good pacing reference. Revolut Ultra for how a paid tier is made to feel special.

### Palette (starting point, tune freely)
| Token | Hex | Use |
|---|---|---|
| `--ground` | `#07090C` | Page background (dark) |
| `--surface` | `#0F1318` | Cards, sections |
| `--surface-2` | `#161B22` | Raised elements, inputs |
| `--line` | `rgba(255,255,255,0.08)` | Hairlines |
| `--text` | `#F3F5F7` | Primary text |
| `--text-2` | `#9AA4B2` | Secondary text |
| `--accent` | `#3D7BFF` | Primary CTA, links, focus (electric fintech blue) |
| `--accent-2` | `#7FE3C4` | Positive states, cashback highlights (mint) |
| `--metal-black` | `linear-gradient(135deg,#2A2D31,#0C0D0F 55%,#1F2124)` | Black tier card |
| `--metal-silver` | `linear-gradient(135deg,#E8EBEF,#A9B0B8 50%,#F4F6F8)` | Plus tier card |
| `--warn` / `--danger` | `#F5B544` / `#FF5C5C` | Protection section only |

A light section (e.g. tiers or FAQ on `#F4F6F8`) is allowed for rhythm. Accent choice between blue and a violet-blue is **Kimi's call**; keep one accent.

> Note: the MVP app currently uses a warm "plaster/brass" identity (`app/src/app/globals.css`). The landing page moves to this cooler fintech palette on purpose. Luis will decide later whether the app follows; don't change the app.

### Typography
**Banned** (overused in AI-generated sites): Inter, Space Grotesk, DM Sans, Geist, Manrope, Poppins, Montserrat, Instrument Serif, Fraunces, Playfair Display, IBM Plex (any), JetBrains Mono, Roboto, Bodoni Moda, Hanken Grotesk.

Pick one pairing (all free, verified available Sept 14):
| Option | Display | Text | Numbers | Load |
|---|---|---|---|---|
| **A (recommended)** | Funnel Display | Funnel Sans | Martian Mono | `next/font/google` |
| B | Host Grotesk (tight tracking) | Host Grotesk | Azeret Mono | `next/font/google` |
| C | Satoshi | Switzer | Azeret Mono | Fontshare, self-host with `next/font/local` |

Rules: display face only for headlines and big numbers; tabular numbers for money; no more than 3 weights per family.

### Components ("cool React components")
Stack: Next.js 16 App Router, React 19, Tailwind CSS 4, TypeScript, **Motion** (`motion`, formerly Framer Motion). Copy-paste component sources are fine (shadcn/ui primitives, Magic UI, Aceternity UI, React Bits) — adapt them to the tokens, don't ship their default look.

Ideas, pick what serves the page (**Kimi's call**):
- **3D metal card** in the hero that tilts with the pointer and catches a light sweep (CSS 3D or React Three Fiber if it stays under budget).
- **Tier card switcher**: clicking Standard/Plus/Black flips the hero card finish.
- **Asset marquee** of real cards and watches with insured value chips.
- **Bento grid** for "How it works" and protection features.
- **Live-feeling calculator** with a slider and a health bar that changes color at 50% / 65%.
- **Number tickers** for cashback examples.
- **Spotlight / gradient border** hover on tier cards.

### Motion and performance
- One orchestrated hero entrance, subtle scroll reveals after that. Everything readable without animation; respect `prefers-reduced-motion`.
- Lighthouse mobile ≥ 90 performance, ≥ 95 accessibility. LCP < 2.5s on 4G. Images via `next/image`, AVIF/WebP.
- 360 px minimum width, no horizontal scroll.

### Card design
The StockCard card: metal finish per tier, "StockCard" wordmark, chip, contactless mark, network shown as **text placeholder "VISA"** (no Visa/Mastercard logos until an issuer approves). Card number never shown in full.

## 8. FAQ (minimum)
1. What can I use as collateral? (stocks, graded cards, watches, art notes; never memecoins)
2. Do I have to sell my assets? (No, you lock them and borrow against them)
3. What happens if prices fall? (buffer, alerts, add collateral or repay; liquidation only as a last resort)
4. Who holds my assets? (an on-chain Solana program; StockCard can't move them)
5. What does it cost? (APR 9.9–14.9% depending on how much you borrow, tier fees in §5)
9. How does Savings work and where does the yield come from? (borrowers' interest; 60% to savers; variable)
10. What is the founding member offer? (§5)
11. Can I use cards from Solflare Packs? (they are Collector Crypt NFTs; eligibility planned)
6. When can I get the card? (devnet beta now, waitlist for launch; no date promised)
7. Which countries? (EU first; availability depends on the card issuer)
8. How does cashback work? (it buys the asset you choose and adds it to your collateral)

## 9. Honesty and legal guardrails (non-negotiable)
- **Status line** everywhere a card or benefit appears: "In development · Devnet beta · Not available yet".
- **No partner claims.** Collector Crypt, Phygitals, Beezie, xStocks, Backpack, Bridge, Rain, Chainlink, Switchboard are integration targets, not partners. No partner logos in a "partners" or "trusted by" row.
- **Asset images**: caption "Example of a tokenized item on Solana (Collector Crypt marketplace). Not affiliated." Watch and trading-card brand names are trademarks of their owners. Use images only per `assets.md` (permission status).
- **Planned perks** footnote as in §5.
- Footer disclaimer: "StockCard is in development. Nothing on this site is an offer of credit, securities or a payment card. Borrowing against assets carries the risk of liquidation."
- No fake testimonials, user counts or press logos.

## 10. Kimi's call (left open on purpose)
- Hero composition and the signature interaction.
- Accent hue within the fintech blue/violet range, and whether one light section is used.
- Illustration vs. photography balance; iconography style.
- Micro-copy for section intros (keep the headline and legal lines as written).
- Section order within §3, and whether the calculator lives in the hero or lower.

## 11. Done when
- Deployed on Vercel, own project, production URL shared.
- Waitlist signup, queue position and referral link work end to end.
- All §9 guardrails visible; all numbers match §5–§6.
- Lighthouse targets met; works at 360 px; keyboard-navigable; reduced motion honored.
- `README.md` in the project explains run, env vars and deploy.

## Sources (inspiration, checked Sept 14, 2026)
- Revolut Ultra: https://www.revolut.com/en-NL/ultra-plan/ (page blocked automated reading; benefits from Revolut press release and help centre: lounge access, subscriptions, insurance, cashback)
- KAST: https://www.kast.xyz/ (tiers Standard free 1.5% · Premium $1,000/yr 2% · Private $10,000/yr 3%)
- Nexo card: https://nexo.com/eea/crypto-card (credit vs debit mode, up to 2% cashback, loyalty tiers)
- Solflare card: https://www.solflare.com/crypto-card/ (dark, section rhythm, self-custody messaging)
