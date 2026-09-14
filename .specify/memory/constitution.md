# StockCard Constitution

## Core Principles

### I. Demo-first vertical slices
Every user story ships end to end: program instruction → app screen → devnet transaction visible in an explorer. No layer gets built ahead of a slice that uses it. If the Friday deadline forces a cut, cut whole stories, never half of each. The P1 slice (deposit → borrow → card spend) must work before any P2 work starts.

### II. Real assets only
Collateral and cashback purchases are limited to tokenized equities, art notes and whitelisted collectibles. The program MUST NOT create markets for memecoins, governance tokens or other volatile crypto. USDC is only the borrow and spend asset.

### III. Collateral safety lives in the program
- Every `borrow`, `withdraw_collateral` and `liquidate` checks LTV against a price that passes a staleness check, inside the same instruction.
- All math is integer, in base units and basis points, with checked arithmetic. No floats on-chain.
- Interest accrues before any state change.
- The client never decides whether an action is safe. It only previews what the program will enforce.

### IV. Issuer-agnostic card, secrets on the server
- The card integration sits behind one `CardProvider` interface. Bridge sandbox and the mock provider are interchangeable.
- API keys and server keypairs stay in route handlers. Only `NEXT_PUBLIC_*` values reach the browser.
- The server never holds user collateral. It can only spend what a user delegated to the card.

### V. One codebase, mobile first
- The web app is the Android app: a PWA using Mobile Wallet Adapter, packaged as an APK with `solana-mobile webshell`.
- Every screen MUST work at 360 px wide in Android Chrome before it counts as done.

### VI. Honest demo
Mock mints, the mock card provider, admin-set prices and placeholder artworks are labeled as such in the UI and the README. Nothing is presented as a real acquisition, partnership or mainnet asset.

## Constraints
- Devnet only. Anchor 1.2 program, Next.js 16 app, deployed on Vercel.
- Commits authored as `littleplu@gmail.com` (Vercel requirement).
- Deadline: Stocklana submission, Fri Sept 18, 2026, 4:00 PM ET. Target: submit by noon ET.

## Development workflow
- Spec Kit flow: spec.md → plan.md → tasks.md → implement. Tasks are checked off in `specs/001-stockcard-mvp/tasks.md` as they land.
- Program changes need a passing `anchor test` for the affected instruction before the UI uses them.
- Each day ends with a devnet deploy and a smoke run of the P1 flow.

## Governance
This constitution overrides conflicting guidance in plan or task files. Amendments are made by editing this file with a dated note.

**Version**: 1.0.0 | **Ratified**: 2026-09-14 | **Last Amended**: 2026-09-14
