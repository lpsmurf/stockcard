# Quickstart: StockCard MVP

## Prerequisites
- Node 20+, npm
- Rust (rustup), Solana CLI 3.x, Anchor CLI 1.2.0: `cargo install anchor-cli --version 1.2.0 --locked`
- A devnet keypair: `solana-keygen new -o ~/.config/solana/id.json` then `solana config set --url devnet && solana airdrop 2`
- For the APK (Thursday): JDK 17, Android SDK, `solana-mobile` CLI (webshell)

## Program
```bash
anchor build
anchor test                       # local validator, Signed markets
anchor deploy --provider.cluster devnet
./scripts/sync-idl.sh             # copies target/idl + types into app/src/lib/idl
npx tsx scripts/seed-devnet.ts    # mock mints, markets, signed prices, pool funding
```

## App
```bash
cd app
cp ../.env.example .env.local     # fill program id, mints, server secrets
npm install
npm run dev                       # http://localhost:3000
```
Android on the same network: open `http://<your-lan-ip>:3000` in Android Chrome with Phantom/Solflare installed. MWA needs HTTPS outside localhost, so use the Vercel preview URL or `npx localtunnel --port 3000`.

## P1 smoke test (manual)
1. Connect wallet → Assets → Faucet NVDAx.
2. Deposit 10 NVDAx → Home shows available credit.
3. Borrow $500 to card → Card → set limit $500 (approve).
4. Test purchase "Groceries $62.15" → the feed shows Settled with an explorer link; cashback row appears.
5. Repay all → Assets → Withdraw all.

Script version: `npx tsx scripts/smoke-devnet.ts` prints each signature as an explorer link.

## Android APK
```bash
npx solana-mobile webshell init   # in android/, point at the Vercel URL
npx solana-mobile webshell build
adb install android/app/build/outputs/apk/release/*.apk
```
(Follow docs.solanamobile.com/dapp-publishing/publishing-a-pwa. Command names may change; check the docs on Thursday.)
