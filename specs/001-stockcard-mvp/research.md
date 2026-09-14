# Research: StockCard MVP

## R1. Android: native app vs PWA
- **Decision**: One Next.js PWA using Mobile Wallet Adapter, packaged as an Android APK with the `solana-mobile webshell` command.
- **Rationale**: One codebase for a 4-day build. Solana Mobile's docs replaced Bubblewrap/TWA with webshell because browsers' Local Network Access restrictions break MWA inside TWA wrappers. The webshell WebView handles wallet intents natively and needs no Digital Asset Links. Apps must use `@solana-mobile/wallet-standard-mobile` ≥ 0.5.1 so they detect the shell.
- **Alternatives**: Expo/React Native with the MWA RN SDK. Rejected because it's a second UI codebase and there's no Android SDK on the dev machine today. Bubblewrap TWA was rejected because of the MWA breakage above.
- **Needs**: Android SDK + JDK 17 on Thursday for the APK build (the machine has JDK 15, no SDK).

## R2. Program framework and versions
- **Decision**: Anchor 1.2.0 (`anchor-lang`, `anchor-spl`, CLI installed from crates.io) with `pyth-solana-receiver-sdk` 2.0.0, whose `anchor-lang ^1.0.2` requirement matches.
- **TS client**: `@anchor-lang/core` 1.2.0 (the renamed `@coral-xyz/anchor`, which stopped at 0.32.1).
- **Note**: installing `avm` from git failed on this machine (git auth), so we use `cargo install anchor-cli --version 1.2.0 --locked`.

## R3. Oracles
- **Decision**: `OracleKind::Pyth` for equities (Hermes update posted in the same transaction via `@pythnetwork/pyth-solana-receiver`), `OracleKind::Signed` for art appraisals, collectible FMV and the devnet crash demo.
- **Rationale**: Equity feeds go stale when markets are closed, and Pyth tests on localnet are slow and brittle. Signed markets keep tests deterministic.
- **Risk**: If the Pyth equity path isn't working on devnet by Wednesday noon, switch equity markets to Signed with a "Demo price" badge (this is in spec assumptions).

## R4. Card
- **Decision**: `CardProvider` interface. `MockCardProvider` is the default and mirrors Bridge's non-custodial model: the user approves a USDC delegate, and the server-side card authority transfers on purchase. `BridgeCardProvider` is enabled when `BRIDGE_API_KEY` is set.
- **Rationale**: Bridge sandbox access is applied for but not guaranteed by Friday. The delegate model means switching providers doesn't change the user flow.
- **Bridge facts** (RESEARCH.md): card account with `crypto_wallet{chain:"solana",currency:"usdc",address}`, devnet USDC `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`.

## R5. Card and wallet UI references (open source)
| Project | License | Use |
|---|---|---|
| [JuandaGarcia/crd-ui](https://github.com/JuandaGarcia/crd-ui) | MIT, active (Aug 2026), zero deps, React/Vue/Svelte | Card layout, number masking, brand detection. Primary reference. |
| [amaroteam/react-credit-cards](https://github.com/amaroteam/react-credit-cards) | MIT, 2.6k★, last push Jan 2024 | Card flip/front-back pattern; too old to depend on (React 19) |
| [iamalperen/react-credit-card-ui](https://github.com/iamalperen/react-credit-card-ui) | **No license**, don't copy | Visual inspiration only |
| [mthstv/cards-wallet](https://github.com/mthstv/cards-wallet) | **No license**, don't copy | Wallet stack layout inspiration only |
- **Decision**: Build our own `CreditCard` component in the StockCard brand (dark gunmetal card, brass chip, Bodoni wordmark from the deck). Borrow the masking and brand-detection approach from crd-ui (MIT, keep attribution).
- **Trademarks**: Visa/Mastercard marks appear as text placeholders ("VISA · sandbox") until an issuer program approves brand use.

## R6. USDC liquidity on devnet
- **Decision**: Program is mint-agnostic via `Config.usdc_mint`. Try Circle devnet USDC first; if the faucet can't fund a ≥ $5k pool, use a mock 6-decimal `dUSDC` mint (env `NEXT_PUBLIC_USDC_MINT`).
- **Trade-off**: A mock USDC breaks the "real Bridge devnet USDC" story, but only if Bridge isn't used anyway.

## R8. Partner APIs for RWA collateral
- **Decision**: Automate equities via the xStocks public API + Pyth; price graded cards from Collector Crypt `insuredValue` with PSA cert verification; keep art, watches and Phygitals/Beezie cards on admin-signed prices until partnerships exist. Full details are in integrations.md.
- **Consequences**: collateral transfers use `token_interface` (Token-2022); valuation applies the Scaled UI Amount multiplier; mock equity mints are Token-2022 with that extension; MVP collectibles support standard NFTs only.

## R7. Off-chain storage
- **Decision**: Upstash Redis via Vercel Marketplace (free tier) for cards, transactions and the cashback queue; in-memory adapter for local dev.
- **Alternative**: Postgres. Overkill for a demo.
