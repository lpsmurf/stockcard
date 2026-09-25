# StockCard landing site

Waitlist landing page for StockCard. Next.js 16 App Router, React 19, Tailwind CSS 4, TypeScript. Separate project from `app/` — deploys as its own Vercel project.

## Run locally

```bash
npm install
npm run dev          # http://localhost:3000
```

Other scripts:

```bash
npm run build        # production build
npm run fetch-images # re-download RWA images into public/assets/rwa/ (sharp → WebP)
```

## Environment variables

Copy `.env.example` to `.env.local`:

| Var | Required | Purpose |
|---|---|---|
| `KV_REST_API_URL` | yes (waitlist) | Upstash Redis REST URL — same provider as the app |
| `KV_REST_API_TOKEN` | yes (waitlist) | Upstash Redis REST token |
| `RESEND_API_KEY` | optional | Double opt-in email. If unset, rate-limit by IP and reject disposable domains |
| `NEXT_PUBLIC_SITE_URL` | recommended | Canonical URL for metadata / OG / referral links |
| `NEXT_PUBLIC_DEMO_URL` | recommended | Link target of the "Try the demo" section (the devnet app URL) |

Without the KV vars the waitlist API falls back to an in-memory store (dev only — data vanishes on restart).

## Waitlist mechanics

- `POST /api/waitlist` — validates email (rejects disposable domains), asset/cashback choices, optional Solana wallet (base58 shape). Rate limit: 5 signups/hour/IP. Returns `{ position, referralCode, referralUrl }`.
- `GET /api/waitlist/[code]` — returns `{ position, referralCount }` for a referral code.
- Storage keys: `waitlist:{email}` (hash), `ref:{code}` → email, `queue` (sorted set, score = join timestamp).
- Referral bump: effective position = base position − 10 × confirmed referrals, clamped ≥ 1. Referrer reward recorded: "Plus cashback 3 months".
- Analytics events (Vercel Analytics): `calculator_view`, `signup_start`, `signup_complete`, `referral_share`.

## Deploy (Luis — Vercel)

Vercel commands were intentionally not run by the build agent. One-time setup:

1. `cd landing && npx vercel link` — create a **new** Vercel project (e.g. `stockcard-landing`), **root directory `landing`** (or create the project in the Vercel dashboard: New Project → import repo → set Root Directory to `landing`).
2. Set env vars in the Vercel project (Production + Preview): `KV_REST_API_URL`, `KV_REST_API_TOKEN`, `NEXT_PUBLIC_SITE_URL` (the production URL), and optionally `RESEND_API_KEY`.
3. `npx vercel --prod` (or push to the connected Git branch).
4. Add the custom domain once one is chosen, then update `NEXT_PUBLIC_SITE_URL`.

Commit as `littleplu@gmail.com` — Vercel deploys break with other author emails.

## Layout

- `src/app/` — routes, `api/waitlist` handlers, and global styles (design tokens from `specs/002-landing-site/brief.md` §7 in `globals.css`)
- `src/components/` — `StockCardVisual` (3D metal card, tier finishes), `WaitlistForm`, `sections/` (hero → footer, brief §3 order)
- `src/data/` — `tiers.ts` (tiers/rates/founding offer/compare table, brief §5), `rwa-examples.ts` (asset images), `faq.ts` (brief §8)
- `src/lib/credit.ts` — LTV / liquidation / APR / daily-interest math (brief §6); `src/lib/waitlist.ts` — waitlist storage/validation/referrals
- `scripts/fetch-rwa-images.ts` — image pipeline for `public/assets/rwa/`
