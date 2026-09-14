/**
 * T016/T070: seed devnet — mock mints (Token-2022 equities with Scaled UI Amount +
 * Pausable + Permanent Delegate), dUSDC, markets, signed prices, pool funding,
 * cashback treasury. Idempotent: skips mints/markets that already exist.
 * Writes NEXT_PUBLIC_* mint vars and server keypairs into app/.env.local (line-level upsert).
 *
 * Usage: npx tsx scripts/seed-devnet.ts
 */
import * as anchor from "@anchor-lang/core";
import {
  createAssociatedTokenAccount,
  createInitializeMintInstruction,
  createInitializePausableConfigInstruction,
  createInitializePermanentDelegateInstruction,
  createInitializeScaledUiAmountConfigInstruction,
  getAssociatedTokenAddressSync,
  getMintLen,
  ExtensionType,
  mintTo,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import * as fs from "node:fs";
import * as path from "node:path";
import bs58 from "bs58";

const ROOT = path.resolve(__dirname, "..");
const PROGRAM_ID = new PublicKey("HsXyxfSvp7mha6bxgh3Qr9NoVmMVe6HmynVguRfBLWrY");

function readEnvFile(): Map<string, string> {
  const file = path.join(ROOT, "app", ".env.local");
  const map = new Map<string, string>();
  if (fs.existsSync(file)) {
    for (const line of fs.readFileSync(file, "utf8").split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m) map.set(m[1], m[2]);
    }
  }
  return map;
}

const RPC =
  process.env.NEXT_PUBLIC_SOLANA_RPC ??
  readEnvFile().get("NEXT_PUBLIC_SOLANA_RPC") ??
  "https://api.devnet.solana.com";

/** Retry on-chain calls through RPC rate limits. */
async function withRetry<T>(fn: () => Promise<T>, label = "op"): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      const msg = String(e);
      if (attempt >= 8 || !/429|Too many|rate|timeout|Timed out|fetch failed|Blockhash not found|blockhash/i.test(msg)) throw e;
      const wait = Math.min(1000 * 2 ** attempt, 20_000);
      console.log(`  retry ${label} in ${wait}ms (${msg.slice(0, 60)})`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
}

const EXPO = -6;
const usd6 = (usd: number) => new anchor.BN(Math.round(usd * 1e6));

const EQUITY_BANDS = [
  { maxLtvBps: 2000, aprBps: 990 },
  { maxLtvBps: 3500, aprBps: 1290 },
  { maxLtvBps: 5000, aprBps: 1490 },
];
const COLLECTIBLE_BANDS = [
  { maxLtvBps: 2000, aprBps: 1190 },
  { maxLtvBps: 4000, aprBps: 1590 },
  { maxLtvBps: 0, aprBps: 0 },
];
const ART_BANDS = [
  { maxLtvBps: 1500, aprBps: 1190 },
  { maxLtvBps: 3000, aprBps: 1590 },
  { maxLtvBps: 0, aprBps: 0 },
];

interface MintSpec {
  envKey: string;
  symbol: string;
  decimals: number;
  token2022: boolean;
  multiplier?: number;
  priceUsd: number;
  assetClass: "equity" | "artNote" | "collectible";
  source: "market" | "appraisal" | "partnerFmv";
  risk: { maxLtv: number; liq: number; bonus: number; haircut: number; maxAge: number; closedAge: number; closedHaircut: number };
  bands: { maxLtvBps: number; aprBps: number }[];
}

const SPECS: MintSpec[] = [
  { envKey: "NEXT_PUBLIC_MINT_NVDAX", symbol: "NVDAx", decimals: 8, token2022: true, multiplier: 1.001701, priceUsd: 211.96, assetClass: "equity", source: "market", risk: { maxLtv: 5000, liq: 6500, bonus: 500, haircut: 0, maxAge: 180, closedAge: 259200, closedHaircut: 1000 }, bands: EQUITY_BANDS },
  { envKey: "NEXT_PUBLIC_MINT_SPYX", symbol: "SPYx", decimals: 8, token2022: true, multiplier: 1.005715, priceUsd: 761.76, assetClass: "equity", source: "market", risk: { maxLtv: 5000, liq: 6500, bonus: 500, haircut: 0, maxAge: 180, closedAge: 259200, closedHaircut: 1000 }, bands: EQUITY_BANDS },
  { envKey: "NEXT_PUBLIC_MINT_TSLAX", symbol: "TSLAx", decimals: 8, token2022: true, multiplier: 1.0, priceUsd: 363.36, assetClass: "equity", source: "market", risk: { maxLtv: 5000, liq: 6500, bonus: 500, haircut: 0, maxAge: 180, closedAge: 259200, closedHaircut: 1000 }, bands: EQUITY_BANDS },
  { envKey: "NEXT_PUBLIC_MINT_SPCX", symbol: "SPCX", decimals: 6, token2022: true, multiplier: 1.0, priceUsd: 150.77, assetClass: "equity", source: "market", risk: { maxLtv: 5000, liq: 6500, bonus: 500, haircut: 1000, maxAge: 180, closedAge: 259200, closedHaircut: 2000 }, bands: EQUITY_BANDS },
  { envKey: "NEXT_PUBLIC_MINT_TIDE", symbol: "TIDE", decimals: 6, token2022: false, priceUsd: 10.0, assetClass: "artNote", source: "appraisal", risk: { maxLtv: 3000, liq: 4500, bonus: 1000, haircut: 2000, maxAge: 8640000, closedAge: 0, closedHaircut: 0 }, bands: ART_BANDS },
  { envKey: "NEXT_PUBLIC_MINT_CC_LUGIA", symbol: "CC-LUGIA", decimals: 0, token2022: false, priceUsd: 54000, assetClass: "collectible", source: "partnerFmv", risk: { maxLtv: 4000, liq: 5500, bonus: 800, haircut: 2500, maxAge: 691200, closedAge: 0, closedHaircut: 0 }, bands: COLLECTIBLE_BANDS },
  { envKey: "NEXT_PUBLIC_MINT_CC_RAYQUAZA", symbol: "CC-RAYQUAZA", decimals: 0, token2022: false, priceUsd: 13000, assetClass: "collectible", source: "partnerFmv", risk: { maxLtv: 4000, liq: 5500, bonus: 800, haircut: 2500, maxAge: 691200, closedAge: 0, closedHaircut: 0 }, bands: COLLECTIBLE_BANDS },
  { envKey: "NEXT_PUBLIC_MINT_CC_MEW", symbol: "CC-MEW", decimals: 0, token2022: false, priceUsd: 5500, assetClass: "collectible", source: "partnerFmv", risk: { maxLtv: 4000, liq: 5500, bonus: 800, haircut: 2500, maxAge: 691200, closedAge: 0, closedHaircut: 0 }, bands: COLLECTIBLE_BANDS },
  { envKey: "NEXT_PUBLIC_MINT_CC_DAYTONA", symbol: "CC-DAYTONA", decimals: 0, token2022: false, priceUsd: 74200, assetClass: "collectible", source: "partnerFmv", risk: { maxLtv: 4000, liq: 5500, bonus: 800, haircut: 2500, maxAge: 691200, closedAge: 0, closedHaircut: 0 }, bands: COLLECTIBLE_BANDS },
  { envKey: "NEXT_PUBLIC_MINT_CC_ROYALOAK", symbol: "CC-ROYALOAK", decimals: 0, token2022: false, priceUsd: 51315, assetClass: "collectible", source: "partnerFmv", risk: { maxLtv: 4000, liq: 5500, bonus: 800, haircut: 2500, maxAge: 691200, closedAge: 0, closedHaircut: 0 }, bands: COLLECTIBLE_BANDS },
  { envKey: "NEXT_PUBLIC_MINT_CC_SEAMASTER", symbol: "CC-SEAMASTER", decimals: 0, token2022: false, priceUsd: 10600, assetClass: "collectible", source: "partnerFmv", risk: { maxLtv: 4000, liq: 5500, bonus: 800, haircut: 2500, maxAge: 691200, closedAge: 0, closedHaircut: 0 }, bands: COLLECTIBLE_BANDS },
];

function loadKeypair(file: string): Keypair {
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(file, "utf8"))));
}

const AUTH_FILE = path.join(ROOT, "scripts", "authorities.keypair.json");
function loadAuthorities(): Record<string, Keypair> {
  if (fs.existsSync(AUTH_FILE)) {
    const raw = JSON.parse(fs.readFileSync(AUTH_FILE, "utf8"));
    return Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Keypair.fromSecretKey(bs58.decode(v as string))]));
  }
  const auths = {
    faucet: Keypair.generate(),
    cashback: Keypair.generate(),
    card: Keypair.generate(),
    merchant: Keypair.generate(),
    shop: Keypair.generate(),
  };
  fs.writeFileSync(
    AUTH_FILE,
    JSON.stringify(Object.fromEntries(Object.entries(auths).map(([k, v]) => [k, bs58.encode(v.secretKey)])), null, 2),
    { mode: 0o600 },
  );
  return auths;
}


function upsertEnvFile(updates: Record<string, string>) {
  const file = path.join(ROOT, "app", ".env.local");
  const lines = fs.existsSync(file) ? fs.readFileSync(file, "utf8").split("\n") : [];
  const seen = new Set<string>();
  const out = lines.map((line) => {
    const m = line.match(/^([A-Z0-9_]+)=/);
    if (m && m[1] in updates) {
      seen.add(m[1]);
      return `${m[1]}=${updates[m[1]]}`;
    }
    return line;
  });
  for (const [k, v] of Object.entries(updates)) {
    if (!seen.has(k)) out.push(`${k}=${v}`);
  }
  fs.writeFileSync(file, out.join("\n"));
}

async function createMockMint(
  connection: Connection,
  payer: Keypair,
  spec: MintSpec,
  mintAuthority: PublicKey,
  issuerAuthority: PublicKey,
): Promise<PublicKey> {
  const mintKp = Keypair.generate();
  if (!spec.token2022) {
    const { createMint } = await import("@solana/spl-token");
    return createMint(connection, payer, mintAuthority, null, spec.decimals, mintKp, undefined, TOKEN_PROGRAM_ID);
  }
  const extensions = [ExtensionType.ScaledUiAmountConfig, ExtensionType.PausableConfig, ExtensionType.PermanentDelegate];
  const mintLen = getMintLen(extensions);
  const lamports = await connection.getMinimumBalanceForRentExemption(mintLen);
  const tx = new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: payer.publicKey,
      newAccountPubkey: mintKp.publicKey,
      space: mintLen,
      lamports,
      programId: TOKEN_2022_PROGRAM_ID,
    }),
    createInitializeScaledUiAmountConfigInstruction(
      mintKp.publicKey,
      issuerAuthority,
      spec.multiplier ?? 1,
      TOKEN_2022_PROGRAM_ID,
    ),
    createInitializePausableConfigInstruction(mintKp.publicKey, issuerAuthority, TOKEN_2022_PROGRAM_ID),
    createInitializePermanentDelegateInstruction(mintKp.publicKey, issuerAuthority, TOKEN_2022_PROGRAM_ID),
    createInitializeMintInstruction(mintKp.publicKey, spec.decimals, mintAuthority, null, TOKEN_2022_PROGRAM_ID),
  );
  await sendAndConfirmTransaction(connection, tx, [payer, mintKp]);
  return mintKp.publicKey;
}

async function main() {
  const admin = loadKeypair(path.join(ROOT, ".devnet-wallet.json"));
  const auths = loadAuthorities();
  const connection = new Connection(RPC, "confirmed");
  const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(admin), { commitment: "confirmed" });
  const idl = JSON.parse(fs.readFileSync(path.join(ROOT, "target", "idl", "stockcard.json"), "utf8"));
  const program = new anchor.Program(idl, provider);

  const env = readEnvFile();
  const updates: Record<string, string> = {};

  const pda = (...seeds: (Buffer | Uint8Array)[]) => PublicKey.findProgramAddressSync(seeds, PROGRAM_ID)[0];
  const configPda = pda(Buffer.from("config"));
  const usdcVaultPda = pda(Buffer.from("usdc_vault"));
  const marketPda = (mint: PublicKey) => pda(Buffer.from("market"), mint.toBuffer());
  const collVaultPda = (market: PublicKey) => pda(Buffer.from("collateral_vault"), market.toBuffer());
  const pricePda = (market: PublicKey) => pda(Buffer.from("price"), market.toBuffer());

  // dUSDC (6 decimals, mint authority = faucet authority). If the env mint exists but
  // isn't controlled by our faucet authority (e.g. Circle devnet USDC), create our own.
  let usdcMint: PublicKey;
  const existingUsdc = env.get("NEXT_PUBLIC_USDC_MINT");
  let reuseUsdc = false;
  if (existingUsdc) {
    const addr = new PublicKey(existingUsdc);
    const info = await withRetry(() => connection.getAccountInfo(addr), "check usdc mint");
    if (info) {
      const { unpackMint } = await import("@solana/spl-token");
      const mint = unpackMint(addr, info, TOKEN_PROGRAM_ID);
      reuseUsdc = mint.mintAuthority !== null && mint.mintAuthority.equals(auths.faucet.publicKey);
      if (!reuseUsdc) console.log("existing USDC_MINT not controlled by faucet authority; creating fresh dUSDC");
    }
  }
  if (reuseUsdc) {
    usdcMint = new PublicKey(existingUsdc!);
  } else {
    const { createMint } = await import("@solana/spl-token");
    usdcMint = await withRetry(
      () => createMint(connection, admin, auths.faucet.publicKey, null, 6, undefined, undefined, TOKEN_PROGRAM_ID),
      "create dUSDC",
    );
    console.log("dUSDC mint:", usdcMint.toBase58());
    updates["NEXT_PUBLIC_USDC_MINT"] = usdcMint.toBase58();
    upsertEnvFile(updates); // incremental: never lose a created mint on crash
  }

  // init_config (skip if present)
  const configInfo = await withRetry(() => connection.getAccountInfo(configPda), "fetch config");
  if (!configInfo) {
    await withRetry(() => program.methods
      .initConfig(4000, 9000, 5000, auths.cashback.publicKey, admin.publicKey)
      .accounts({
        admin: admin.publicKey,
        config: configPda,
        usdcMint,
        usdcVault: usdcVaultPda,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc(), "init_config");
    console.log("init_config done");
  } else {
    console.log("config exists, skipping init");
  }

  // mock mints + markets + prices
  for (const spec of SPECS) {
    let mint: PublicKey;
    const existing = readEnvFile().get(spec.envKey); // re-read: earlier iterations upserted
    if (existing) {
      mint = new PublicKey(existing);
    } else {
      mint = await withRetry(
        () => createMockMint(connection, admin, spec, auths.faucet.publicKey, admin.publicKey),
        `create ${spec.symbol}`,
      );
      console.log(`${spec.symbol} mint:`, mint.toBase58());
      updates[spec.envKey] = mint.toBase58();
      upsertEnvFile(updates); // incremental: never lose a created mint on crash
    }
    const market = marketPda(mint);
    const marketInfo = await withRetry(() => connection.getAccountInfo(market), `fetch ${spec.symbol} market`);
    if (!marketInfo) {
      await withRetry(
        () =>
          program.methods
            .addMarket(
              { [spec.assetClass]: {} },
              { signed: {} },
              PublicKey.default,
              spec.risk.maxLtv,
              spec.risk.liq,
              spec.risk.bonus,
              spec.risk.haircut,
              spec.bands,
              spec.risk.maxAge,
              spec.risk.closedAge,
              spec.risk.closedHaircut,
            )
            .accounts({
              admin: admin.publicKey,
              config: configPda,
              collateralMint: mint,
              market,
              collateralVault: collVaultPda(market),
              tokenProgram: spec.token2022 ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID,
            })
            .rpc(),
        `add ${spec.symbol} market`,
      );
      console.log(`${spec.symbol} market added`);
    }
    await withRetry(
      () =>
        program.methods
          .setSignedPrice(usd6(spec.priceUsd), EXPO, { [spec.source]: {} })
          .accounts({ signer: admin.publicKey, config: configPda, market, signedPrice: pricePda(market) })
          .rpc(),
      `price ${spec.symbol}`,
    );
    console.log(`${spec.symbol} price $${spec.priceUsd}`);
  }

  // pool funding: 2,000,000 dUSDC via deposit_savings (parameters.md §Pool)
  const adminUsdc = getAssociatedTokenAddressSync(usdcMint, admin.publicKey);
  try {
    await createAssociatedTokenAccount(connection, admin, usdcMint, admin.publicKey);
  } catch {}
  const vaultBal = await withRetry(() => connection.getTokenAccountBalance(usdcVaultPda).catch(() => null), "vault balance");
  if (!vaultBal || BigInt(vaultBal.value.amount) < 2_000_000_000_000n) {
    await withRetry(() => mintTo(connection, admin, usdcMint, adminUsdc, auths.faucet, 2_500_000_000_000n), "mint pool dUSDC");
    await withRetry(
      () =>
        program.methods
          .depositSavings(new anchor.BN("2000000000000"))
          .accounts({
            saver: admin.publicKey,
            config: configPda,
            usdcVault: usdcVaultPda,
            saverUsdc: adminUsdc,
            usdcMint,
            savingsPosition: pda(Buffer.from("savings"), admin.publicKey.toBuffer()),
            usdcTokenProgram: TOKEN_PROGRAM_ID,
          })
          .rpc(),
      "fund pool",
    );
    console.log("pool funded with 2,000,000 dUSDC");
  } else {
    console.log("pool already funded, skipping");
  }

  // cashback treasury: >= 1,000 of each cashback asset (NVDAx, SPYx, TIDE)
  for (const spec of SPECS.filter((s) => ["NVDAx", "SPYx", "TIDE"].includes(s.symbol))) {
    const mint = new PublicKey(updates[spec.envKey] ?? readEnvFile().get(spec.envKey)!);
    const tokenProgram = spec.token2022 ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID;
    const ata = getAssociatedTokenAddressSync(mint, auths.cashback.publicKey, false, tokenProgram);
    try {
      await createAssociatedTokenAccount(connection, admin, mint, auths.cashback.publicKey, undefined, tokenProgram);
    } catch {}
    const bal = await withRetry(() => connection.getTokenAccountBalance(ata).catch(() => null), "treasury balance");
    const target = 1000n * 10n ** BigInt(spec.decimals);
    if (!bal || BigInt(bal.value.amount) < target) {
      await withRetry(() => mintTo(connection, admin, mint, ata, auths.faucet, target, [], undefined, tokenProgram), `mint ${spec.symbol} treasury`);
      console.log(`cashback treasury: 1,000 ${spec.symbol}`);
    }
  }

  // secrets + addresses into app/.env.local (line-level upsert; never touches other lines)
  updates["NEXT_PUBLIC_PROGRAM_ID"] = PROGRAM_ID.toBase58();
  updates["NEXT_PUBLIC_CLUSTER"] = env.get("NEXT_PUBLIC_CLUSTER") || "devnet";
  if (!env.get("ADMIN_SECRET")) updates["ADMIN_SECRET"] = bs58.encode(admin.secretKey);
  if (!env.get("FAUCET_AUTHORITY_SECRET")) updates["FAUCET_AUTHORITY_SECRET"] = bs58.encode(auths.faucet.secretKey);
  if (!env.get("CASHBACK_AUTHORITY_SECRET")) updates["CASHBACK_AUTHORITY_SECRET"] = bs58.encode(auths.cashback.secretKey);
  if (!env.get("CARD_AUTHORITY_SECRET")) updates["CARD_AUTHORITY_SECRET"] = bs58.encode(auths.card.secretKey);
  if (!env.get("MERCHANT_SETTLEMENT_ADDRESS")) updates["MERCHANT_SETTLEMENT_ADDRESS"] = auths.merchant.publicKey.toBase58();
  if (!env.get("SHOP_TREASURY_ADDRESS")) updates["SHOP_TREASURY_ADDRESS"] = auths.shop.publicKey.toBase58();
  if (!env.get("ADMIN_TOKEN")) updates["ADMIN_TOKEN"] = bs58.encode(Keypair.generate().secretKey).slice(0, 32);
  if (!env.get("CRON_SECRET")) updates["CRON_SECRET"] = bs58.encode(Keypair.generate().secretKey).slice(0, 32);
  upsertEnvFile(updates);

  console.log("\nSeed complete. Program:", PROGRAM_ID.toBase58());
  console.log("Authorities (see scripts/authorities.keypair.json):");
  for (const [k, v] of Object.entries(auths)) console.log(`  ${k}: ${v.publicKey.toBase58()}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
