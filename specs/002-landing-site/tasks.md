# Tasks: StockCard landing site (Kimi Code)

Read `brief.md` and `assets.md` first. The MVP (`specs/001-stockcard-mvp`) has priority until the Stocklana submission on Fri Sept 18; start here after that unless Luis says otherwise.

Commit as `littleplu@gmail.com` (Vercel requirement). Don't touch `app/`.

## Phase 1: Setup
- [x] L001 Create `landing/` at repo root: Next.js 16 App Router, TypeScript, Tailwind CSS 4, `src/`, npm (no pnpm/yarn). Separate from `app/`.
- [x] L002 Add `motion`, `@upstash/redis`, `@vercel/analytics`; optional `resend`. Copy-in UI primitives (shadcn/ui, Magic UI, Aceternity, React Bits) only as needed.
- [x] L003 Design tokens from brief §7 in `src/app/globals.css` (dark-first, one light section allowed). Choose the font pairing (brief §7, option A recommended) with `next/font`. Check against the banned-font list.
- [ ] L004 Vercel project with root directory `landing`, env vars: `KV_REST_API_URL`, `KV_REST_API_TOKEN`, optional `RESEND_API_KEY`, `NEXT_PUBLIC_SITE_URL`.

## Phase 2: Content and data
- [x] L010 `src/data/tiers.ts` from brief §5 exactly (mark planned perks with `planned: true`).
- [x] L011 `src/data/rwa-examples.ts` from `assets.md`; script `scripts/fetch-rwa-images.ts` that downloads images to `public/assets/rwa/` and converts to AVIF/WebP (run locally; don't hotlink in production).
- [x] L012 `src/data/faq.ts` from brief §8; `src/lib/credit.ts` calculator math (LTV, liquidation price, daily interest) matching brief §6.

## Phase 3: Sections (brief §3)
- [x] L020 Hero with waitlist form and signature card visual (**Kimi's call** on the interaction)
- [x] L021 Asset strip with captions and "Not affiliated" line
- [x] L022 How it works (Lock → Borrow → Spend → Repay)
- [x] L023 Credit calculator with health bar colors at 50% / 65% and the "can fall X%" line
- [x] L024 Cashback section
- [x] L025 Membership tiers comparison + tier switcher that changes the card finish; "Planned benefits" footnote
- [x] L026 Protection section (buffer, alerts, on-chain custody)
- [x] L027 "Real assets only" manifesto
- [x] L028 FAQ accordion
- [x] L029 Final CTA, footer, disclaimer (brief §9)

## Phase 4: Waitlist
- [x] L030 `POST /api/waitlist`: validate email, reject disposable domains, IP rate limit, store answers, assign queue position and referral code
- [x] L031 `GET /api/waitlist/[code]`: position + referrals count; success screen with share link (X, WhatsApp, copy)
- [x] L032 Referral bump: +10 places per confirmed referral; record reward "Plus cashback 3 months"
- [x] L033 Analytics events: calculator_view, signup_start, signup_complete, referral_share

## Phase 5: Quality and launch
- [x] L040 SEO: title, description, Open Graph image (card render), `sitemap.xml`, `robots.txt`
- [x] L041 Accessibility: keyboard, focus states, contrast, reduced motion, alt text on every asset image
- [x] L042 Performance: Lighthouse mobile ≥ 90 perf / ≥ 95 a11y, LCP < 2.5s; 360 px no horizontal scroll
- [x] L043 Guardrail check against brief §9 (status line, no partner logos, captions, disclaimer, planned-perk footnote)
- [ ] L044 Deploy to Vercel production; `landing/README.md` with run/env/deploy steps; send URL to Luis

## Blocked on Luis / Bart
- [ ] Confirm tier perks and prices (brief §5) before public launch
- [ ] Written image permission from Collector Crypt, or switch to neutral renders (`assets.md`)
- [ ] Domain name
