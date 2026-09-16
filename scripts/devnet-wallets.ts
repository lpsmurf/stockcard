/**
 * 20-wallet devnet run. Every wallet is a fresh keypair with its own scenario, run against the
 * deployed program and the app's own code (risk.ts maths, MockCardProvider, verifyUsdcTransfer),
 * so a PASS means the program and the app agree — not that a copy of the maths agrees with itself.
 *
 *   1-9    full loop per asset: deposit → borrow → repay all → withdraw all, balance restored
 *   10-13  APR bands: position.apr_bps matches selectAprBps() (equities 9.9/12.9/14.9, pre-IPO 11.9/15.9)
 *   14     max LTV boundary: app max borrows, max+1 fails ExceedsMaxLtv, zero fails ZeroAmount
 *   15     withdraw guard: a withdraw that breaks max LTV fails, a safe one succeeds
 *   16-17  crash −40% on --crash-market (default T-KALSHI) → liquidation, close factor, NotLiquidatable after
 *   18     card: approve limit → purchase settles on-chain → over-limit purchase declined
 *   19     SEPA: borrow + transfer to PAYOUT_ADDRESS in one tx → verifyUsdcTransfer accepts / rejects
 *   20     interest accrues, a third party repays, owner closes out
 *
 * Safety:
 *   - Never touches NVDAx prices (the demo crash market; --crash-market NVDAx is refused). The crash
 *     aborts if anyone else has debt on that market, and restores the price in `finally` and on Ctrl-C.
 *   - Runs the card provider with in-memory KV (KV_* env vars are not loaded), so no test data
 *     lands in Upstash.
 *   - Positions are closed out at the end of each scenario; leftover SOL is swept back to admin.
 *
 * Usage:
 *   npx tsx scripts/devnet-wallets.ts                      all 20
 *   npx tsx scripts/devnet-wallets.ts --only 14,16,17      a subset
 *   npx tsx scripts/devnet-wallets.ts --report docs/testing/devnet-20-wallets.md
 *   flags: --concurrency 4  --keep (skip the SOL sweep)  --crash-market PRE-SPACEX
 */
import * as anchor from "@anchor-lang/core";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createApproveInstruction,
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
  mintTo,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import * as fs from "node:fs";
import * as path from "node:path";
import bs58 from "bs58";

const ROOT = path.resolve(__dirname, "..");
const EXPLORER = (sig: string) => `https://explorer.solana.com/tx/${sig}?cluster=devnet`;
const U64_MAX = new anchor.BN("18446744073709551615");
const BPS = 10_000n;
const FUND_LAMPORTS = 25_000_000; // 0.025 SOL per wallet: its own position rent + one ATA; admin pays fees and most ATAs

// ---------- args ----------
const argv = process.argv.slice(2);
const arg = (name: string) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};
const ONLY = (arg("--only") ?? "").split(",").map(Number).filter(Boolean);
const REPORT = arg("--report");
const CONCURRENCY = Number(arg("--concurrency") ?? 4);
const KEEP = argv.includes("--keep");
/** Market to crash for #16-17. Never NVDAx (the demo crash market). */
const CRASH_MARKET = arg("--crash-market") ?? "T-KALSHI";
if (CRASH_MARKET === "NVDAx") throw new Error("--crash-market NVDAx is refused: that's the market the live demo crashes");

// ---------- env: load before importing app libs (config.ts reads process.env at import) ----------
const ENV = new Map<string, string>();
for (const line of fs.readFileSync(path.join(ROOT, "app", ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (!m) continue;
  ENV.set(m[1], m[2]);
  if (!m[1].startsWith("KV_")) process.env[m[1]] ??= m[2]; // KV_* left out → in-memory KV
}
const need = (k: string) => {
  const v = ENV.get(k);
  if (!v) throw new Error(`${k} is not set in app/.env.local`);
  return v;
};

// ---------- results ----------
type Status = "PASS" | "FAIL" | "SKIP";
interface Result {
  id: number;
  name: string;
  asset: string;
  status: Status;
  notes: string[];
  sigs: string[];
  ms: number;
}

class Check extends Error {}
const expect = (cond: unknown, msg: string) => {
  if (!cond) throw new Check(msg);
};

// ---------- main ----------
async function main() {
  const risk = await import("../app/src/lib/risk");
  const { MARKETS } = await import("../app/src/lib/config");
  const { MockCardProvider } = await import("../app/src/lib/card/mock");
  const { verifyUsdcTransfer } = await import("../app/src/lib/payout/mock");
  const { eurToUsdc6, fetchEurRate } = await import("../app/src/lib/payout/provider");

  const connection = new Connection(need("NEXT_PUBLIC_SOLANA_RPC"), "confirmed");
  const admin = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(path.join(ROOT, ".devnet-wallet.json"), "utf8"))));
  const faucet = Keypair.fromSecretKey(bs58.decode(need("FAUCET_AUTHORITY_SECRET")));
  const cardAuthority = Keypair.fromSecretKey(bs58.decode(need("CARD_AUTHORITY_SECRET")));
  const merchant = new PublicKey(need("MERCHANT_SETTLEMENT_ADDRESS"));
  const payoutAddress = new PublicKey(need("PAYOUT_ADDRESS"));
  const usdcMint = new PublicKey(need("NEXT_PUBLIC_USDC_MINT"));

  const idl = JSON.parse(fs.readFileSync(path.join(ROOT, "target", "idl", "stockcard.json"), "utf8"));
  const ERRORS = new Map<number, string>((idl.errors ?? []).map((e: { code: number; name: string }) => [e.code, e.name]));
  const walletOf = (kp: Keypair) => ({
    publicKey: kp.publicKey,
    signTransaction: async (tx: Transaction) => (tx.partialSign(kp), tx),
    signAllTransactions: async (txs: Transaction[]) => (txs.forEach((t) => t.partialSign(kp)), txs),
  });
  const provider = new anchor.AnchorProvider(connection, walletOf(admin) as never, { commitment: "confirmed" });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const program = new anchor.Program(idl, provider) as any;
  const programId: PublicKey = program.programId;
  const pda = (...s: (Buffer | Uint8Array)[]) => PublicKey.findProgramAddressSync(s, programId)[0];
  const config = pda(Buffer.from("config"));
  const usdcVault = pda(Buffer.from("usdc_vault"));
  const onchainConfig = await program.account.config.fetch(config);

  /**
   * Retry only when the request provably wasn't processed. A 429 means the RPC rejected the HTTP
   * request, so even a borrow is safe to resend. A confirmation timeout is ambiguous: never retried.
   */
  const RETRYABLE = /429|Too many requests|rate limited|-32429|Blockhash not found|ECONNRESET/i;
  async function retry<T>(fn: () => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await fn();
      } catch (e) {
        const msg = String((e as Error)?.message ?? e);
        if (attempt >= 8 || !RETRYABLE.test(msg)) throw e;
        await new Promise((r) => setTimeout(r, Math.min(1500 * 2 ** attempt, 20_000)));
      }
    }
  }

  function errorName(e: unknown): string {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const any = e as any;
    if (any?.error?.errorCode?.code) return any.error.errorCode.code;
    const logs: string[] = any?.logs ?? any?.transactionLogs ?? [];
    const joined = [String(any?.message ?? e), ...logs].join("\n");
    const named = joined.match(/Error Code: (\w+)/);
    if (named) return named[1];
    const custom = joined.match(/custom program error: (0x[0-9a-f]+)/i);
    if (custom) return ERRORS.get(parseInt(custom[1], 16)) ?? `custom ${custom[1]}`;
    return joined.split("\n")[0].slice(0, 160);
  }

  async function expectError(label: string, fn: () => Promise<unknown>, wanted: string, notes: string[]) {
    try {
      await retry(fn);
    } catch (e) {
      const got = errorName(e);
      expect(got === wanted, `${label}: expected ${wanted}, got ${got}`);
      notes.push(`${label} → ${wanted} ✓`);
      return;
    }
    throw new Check(`${label}: expected ${wanted}, but it succeeded`);
  }

  // ---------- markets ----------
  interface Ctx {
    symbol: string;
    mint: PublicKey;
    market: PublicKey;
    price: PublicKey;
    vault: PublicKey;
    tokenProgram: PublicKey;
    decimals: number;
    multiplierMicro: bigint;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    m: any;
  }
  const ctxCache = new Map<string, Ctx>();
  async function ctx(symbol: string): Promise<Ctx> {
    const cached = ctxCache.get(symbol);
    if (cached) return cached;
    const info = MARKETS.find((x) => x.symbol === symbol);
    if (!info) throw new Error(`unknown market ${symbol}`);
    const mint = new PublicKey(need(info.mintEnvKey));
    const market = pda(Buffer.from("market"), mint.toBuffer());
    const c: Ctx = {
      symbol,
      mint,
      market,
      price: pda(Buffer.from("price"), market.toBuffer()),
      vault: pda(Buffer.from("collateral_vault"), market.toBuffer()),
      tokenProgram: info.token2022 ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID,
      decimals: info.decimals,
      multiplierMicro: info.multiplierMicro,
      m: await retry(() => program.account.market.fetch(market)),
    };
    ctxCache.set(symbol, c);
    return c;
  }

  /** Mirrors oracle.rs: normal haircut within max age, closed-market haircut within closed age, else stale. */
  async function priceView(c: Ctx) {
    const p = await retry(() => program.account.signedPrice.fetch(c.price));
    const age = Math.floor(Date.now() / 1000) - Number(p.publishTime);
    let haircut: bigint | null = null;
    if (age <= c.m.maxPriceAgeSecs) haircut = BigInt(c.m.haircutBps);
    else if (c.m.closedMarketAgeSecs > 0 && age <= c.m.closedMarketAgeSecs) haircut = BigInt(c.m.closedHaircutBps);
    return { priceUsd6: BigInt(p.price.toString()), haircut, age, source: Object.keys(p.source)[0], raw: p };
  }

  async function valueUsd6(c: Ctx, amount: bigint) {
    const v = await priceView(c);
    if (v.haircut === null) throw new Check(`${c.symbol} price is stale (${Math.round(v.age / 60)} min old)`);
    return risk.collateralValue(amount, c.decimals, v.priceUsd6, v.haircut, c.multiplierMicro);
  }

  const bands = (c: Ctx) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (c.m.aprBands as any[]).map((b) => ({ maxLtvBps: b.maxLtvBps, aprBps: b.aprBps }));

  // ---------- wallet helpers ----------
  const positionOf = (c: Ctx, owner: PublicKey) => pda(Buffer.from("position"), c.market.toBuffer(), owner.toBuffer());
  const usdcAta = (owner: PublicKey) => getAssociatedTokenAddressSync(usdcMint, owner, true, TOKEN_PROGRAM_ID);
  const collAta = (c: Ctx, owner: PublicKey) => getAssociatedTokenAddressSync(c.mint, owner, true, c.tokenProgram);

  async function send(ixs: TransactionInstruction[], signers: Keypair[]) {
    return retry(() => sendAndConfirmTransaction(connection, new Transaction().add(...ixs), signers, { commitment: "confirmed" }));
  }

  async function ensureAtas(owner: PublicKey, c?: Ctx) {
    const ixs = [createAssociatedTokenAccountIdempotentInstruction(admin.publicKey, usdcAta(owner), owner, usdcMint, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID)];
    if (c) ixs.push(createAssociatedTokenAccountIdempotentInstruction(admin.publicKey, collAta(c, owner), owner, c.mint, c.tokenProgram, ASSOCIATED_TOKEN_PROGRAM_ID));
    await send(ixs, [admin]);
  }

  async function mintCollateral(c: Ctx, owner: PublicKey, amount: bigint) {
    await retry(() => mintTo(connection, admin, c.mint, collAta(c, owner), faucet, amount, [], { commitment: "confirmed" }, c.tokenProgram));
  }
  async function mintUsdc(owner: PublicKey, amount: bigint) {
    await retry(() => mintTo(connection, admin, usdcMint, usdcAta(owner), faucet, amount, [], { commitment: "confirmed" }, TOKEN_PROGRAM_ID));
  }
  const tokenBalance = async (ata: PublicKey) => BigInt((await connection.getTokenAccountBalance(ata, "confirmed")).value.amount);

  // ---------- instructions ----------
  const deposit = (c: Ctx, user: Keypair, amount: bigint) =>
    retry(() =>
      program.methods
        .depositCollateral(new anchor.BN(amount.toString()))
        .accounts({ owner: user.publicKey, config, market: c.market, position: positionOf(c, user.publicKey), collateralMint: c.mint, ownerToken: collAta(c, user.publicKey), collateralVault: c.vault, signedPrice: c.price, tokenProgram: c.tokenProgram })
        .signers([user])
        .rpc(),
    ) as Promise<string>;

  const borrowIx = (c: Ctx, user: Keypair, amount: bigint) =>
    program.methods
      .borrow(new anchor.BN(amount.toString()))
      .accounts({ owner: user.publicKey, config, market: c.market, position: positionOf(c, user.publicKey), collateralMint: c.mint, usdcVault, usdcMint, destinationUsdc: usdcAta(user.publicKey), signedPrice: c.price, collateralVault: c.vault, usdcTokenProgram: TOKEN_PROGRAM_ID });
  const borrow = (c: Ctx, user: Keypair, amount: bigint) => retry(() => borrowIx(c, user, amount).signers([user]).rpc()) as Promise<string>;

  const repay = (c: Ctx, payer: Keypair, owner: PublicKey, amount: anchor.BN) =>
    retry(() =>
      program.methods
        .repay(amount)
        .accounts({ payer: payer.publicKey, config, market: c.market, position: positionOf(c, owner), collateralMint: c.mint, payerUsdc: usdcAta(payer.publicKey), usdcVault, usdcMint, signedPrice: c.price, usdcTokenProgram: TOKEN_PROGRAM_ID })
        .signers(payer.publicKey.equals(admin.publicKey) ? [] : [payer])
        .rpc(),
    ) as Promise<string>;

  const withdraw = (c: Ctx, user: Keypair, amount: bigint) =>
    retry(() =>
      program.methods
        .withdrawCollateral(new anchor.BN(amount.toString()))
        .accounts({ owner: user.publicKey, config, market: c.market, position: positionOf(c, user.publicKey), collateralMint: c.mint, ownerToken: collAta(c, user.publicKey), collateralVault: c.vault, signedPrice: c.price, tokenProgram: c.tokenProgram })
        .signers([user])
        .rpc(),
    ) as Promise<string>;

  const liquidate = (c: Ctx, owner: PublicKey, repayAmount: bigint) =>
    retry(() =>
      program.methods
        .liquidate(new anchor.BN(repayAmount.toString()))
        .accounts({ liquidator: admin.publicKey, config, market: c.market, position: positionOf(c, owner), collateralMint: c.mint, liquidatorUsdc: usdcAta(admin.publicKey), usdcVault, usdcMint, liquidatorCollateral: collAta(c, admin.publicKey), collateralVault: c.vault, signedPrice: c.price, collateralTokenProgram: c.tokenProgram, usdcTokenProgram: TOKEN_PROGRAM_ID })
        .rpc(),
    ) as Promise<string>;

  const setPrice = (c: Ctx, priceUsd6: bigint, source: "market" | "demo") =>
    retry(() =>
      program.methods
        .setSignedPrice(new anchor.BN(priceUsd6.toString()), -6, { [source]: {} })
        .accounts({ signer: admin.publicKey, config, market: c.market, signedPrice: c.price })
        .rpc(),
    ) as Promise<string>;

  const position = (c: Ctx, owner: PublicKey) => retry(() => program.account.position.fetch(positionOf(c, owner)));

  /** Mint collateral, deposit it, borrow `targetBps` of its value. Returns what an app screen would show. */
  async function openPosition(c: Ctx, user: Keypair, units: bigint, targetBps: bigint, r: Result) {
    const amount = units * 10n ** BigInt(c.decimals);
    await ensureAtas(user.publicKey, c);
    await mintCollateral(c, user.publicKey, amount);
    r.sigs.push(await deposit(c, user, amount));
    const value = await valueUsd6(c, amount);
    const debt = (value * targetBps) / BPS;
    expect(debt > 0n, `borrow amount rounds to zero for ${units} ${c.symbol}`);
    r.sigs.push(await borrow(c, user, debt));
    const pos = await position(c, user.publicKey);
    expect(BigInt(pos.collateralAmount.toString()) === amount, `collateral on-chain ${pos.collateralAmount} ≠ deposited ${amount}`);
    expect(BigInt(pos.debtPrincipal.toString()) === debt, `debt on-chain ${pos.debtPrincipal} ≠ borrowed ${debt}`);
    return { amount, value, debt, pos };
  }

  /** Repay everything (topping up for interest) and withdraw everything; checks nothing is left behind. */
  async function closeOut(c: Ctx, user: Keypair, expectBalance: bigint, r: Result) {
    // Top up whatever the wallet no longer holds (spent on the card, sent to the bank) plus $5 of interest room.
    const pos = await position(c, user.publicKey);
    const elapsed = BigInt(Math.max(0, Math.floor(Date.now() / 1000) - Number(pos.lastAccrualTs)) + 120);
    const owed = risk.accrue(BigInt(pos.debtPrincipal.toString()), BigInt(pos.aprBps), elapsed);
    const have = await retry(() => tokenBalance(usdcAta(user.publicKey)));
    const shortfall = owed + 5_000_000n - have;
    if (shortfall > 0n) await mintUsdc(user.publicKey, shortfall);
    r.sigs.push(await repay(c, user, user.publicKey, U64_MAX));
    const afterRepay = await position(c, user.publicKey);
    expect(BigInt(afterRepay.debtPrincipal.toString()) === 0n, `debt left after repay-all: ${afterRepay.debtPrincipal}`);
    const coll = BigInt(afterRepay.collateralAmount.toString());
    if (coll > 0n) r.sigs.push(await withdraw(c, user, coll));
    const bal = await tokenBalance(collAta(c, user.publicKey));
    expect(bal === expectBalance, `${c.symbol} wallet balance ${bal} ≠ expected ${expectBalance}`);
  }

  const usd = (u6: bigint) => risk.formatUsd(u6);
  const pct = (bps: bigint) => risk.formatPct(bps);

  // ---------- scenarios ----------
  type Scenario = { id: number; name: string; asset: string; group: "parallel" | "crash"; run: (user: Keypair, r: Result) => Promise<void> };

  const loop = (id: number, symbol: string, units: bigint): Scenario => ({
    id,
    name: "full loop",
    asset: symbol,
    group: "parallel",
    run: async (user, r) => {
      const c = await ctx(symbol);
      const target = BigInt(c.m.maxLtvBps) / 2n;
      const o = await openPosition(c, user, units, target, r);
      r.notes.push(`${units} ${symbol} worth ${usd(o.value)} after haircut → borrowed ${usd(o.debt)} (${pct(risk.ltvBps(o.debt, o.value))} LTV), APR ${pct(BigInt(o.pos.aprBps))}`);
      await closeOut(c, user, o.amount, r);
      r.notes.push("repaid all, withdrew all, balance restored");
    },
  });

  const band = (id: number, symbol: string, units: bigint, targetBps: bigint): Scenario => ({
    id,
    name: `APR band @ ${pct(targetBps)}`,
    asset: symbol,
    group: "parallel",
    run: async (user, r) => {
      const c = await ctx(symbol);
      const o = await openPosition(c, user, units, targetBps, r);
      const ltv = risk.ltvBps(o.debt, o.value);
      const want = risk.selectAprBps(bands(c), ltv);
      expect(o.pos.aprBps === want, `apr_bps on-chain ${o.pos.aprBps} ≠ app selectAprBps ${want} at ${pct(ltv)} LTV`);
      r.notes.push(`LTV ${pct(ltv)} → APR ${pct(BigInt(want))} on-chain and in the app`);
      await closeOut(c, user, o.amount, r);
    },
  });

  const scenarios: Scenario[] = [
    loop(1, "NVDAx", 10n),
    loop(2, "SPYx", 3n),
    loop(3, "TSLAx", 5n),
    loop(4, "SPCX", 10n),
    loop(5, "T-OPENAI", 2n),
    loop(6, "PRE-ANTHROPIC", 2n),
    loop(7, "PRE-SPACEX", 15n),
    loop(8, "TIDE", 150n),
    loop(9, "CC-MEW", 1n),
    band(10, "NVDAx", 10n, 1900n),
    band(11, "SPYx", 3n, 3400n),
    band(12, "TSLAx", 5n, 4900n),
    {
      id: 13,
      name: "pre-IPO bands 11.9% → 15.9%",
      asset: "T-OPENAI",
      group: "parallel",
      run: async (user, r) => {
        const c = await ctx("T-OPENAI");
        const o = await openPosition(c, user, 2n, 1500n, r);
        expect(o.pos.aprBps === 1190, `at 15% LTV apr_bps is ${o.pos.aprBps}, expected 1190`);
        const more = (o.value * 2800n) / BPS - o.debt;
        r.sigs.push(await borrow(c, user, more));
        const pos = await position(c, user.publicKey);
        const ltv = risk.ltvBps(BigInt(pos.debtPrincipal.toString()), o.value);
        expect(pos.aprBps === risk.selectAprBps(bands(c), ltv), `after topping up to ${pct(ltv)}, apr_bps ${pos.aprBps} ≠ ${risk.selectAprBps(bands(c), ltv)}`);
        expect(pos.aprBps === 1590, `at ${pct(ltv)} LTV apr_bps is ${pos.aprBps}, expected 1590`);
        r.notes.push(`15% LTV → 11.9%, borrow more to ${pct(ltv)} → 15.9%`);
        await closeOut(c, user, o.amount, r);
      },
    },
    {
      id: 14,
      name: "max LTV boundary",
      asset: "NVDAx",
      group: "parallel",
      run: async (user, r) => {
        const c = await ctx("NVDAx");
        const amount = 10n * 10n ** BigInt(c.decimals);
        await ensureAtas(user.publicKey, c);
        await mintCollateral(c, user.publicKey, amount);
        r.sigs.push(await deposit(c, user, amount));
        const value = await valueUsd6(c, amount);
        const max = risk.availableCredit(0n, value, BigInt(c.m.maxLtvBps));
        await expectError("borrow 0", () => borrow(c, user, 0n), "ZeroAmount", r.notes);
        await expectError(`borrow app max + 1 unit (${usd(max + 1n)})`, () => borrow(c, user, max + 1n), "ExceedsMaxLtv", r.notes);
        r.sigs.push(await borrow(c, user, max));
        r.notes.push(`borrow app max ${usd(max)} → accepted ✓ (app and program agree to the unit)`);
        await expectError("borrow 1 more unit at max", () => borrow(c, user, 1n), "ExceedsMaxLtv", r.notes);
        await closeOut(c, user, amount, r);
      },
    },
    {
      id: 15,
      name: "withdraw guard",
      asset: "SPYx",
      group: "parallel",
      run: async (user, r) => {
        const c = await ctx("SPYx");
        const o = await openPosition(c, user, 3n, 4500n, r);
        const oneUnit = 10n ** BigInt(c.decimals);
        // withdraw.rs raises InsufficientCollateral for an LTV-breaking withdraw; the app's copy for it
        // is "You can withdraw up to {max} while you have a balance" (parameters.md error table).
        await expectError("withdraw 1 SPYx at 45% LTV", () => withdraw(c, user, oneUnit), "InsufficientCollateral", r.notes);
        // Largest withdraw that keeps LTV ≤ 49%: remaining value must be ≥ debt / 0.49.
        const needValue = (o.debt * BPS) / 4900n + 1n;
        const keepAmount = (o.amount * needValue + o.value - 1n) / o.value;
        const safe = o.amount - keepAmount;
        expect(safe > 0n, "no safe withdraw amount");
        r.sigs.push(await withdraw(c, user, safe));
        r.notes.push(`withdraw ${risk.formatTokens(safe, c.decimals)} SPYx keeping LTV under 49% → accepted ✓`);
        await closeOut(c, user, o.amount, r);
      },
    },
    {
      id: 18,
      name: "card spend within / over limit",
      asset: "PRE-SPACEX",
      group: "parallel",
      run: async (user, r) => {
        const c = await ctx("PRE-SPACEX");
        const o = await openPosition(c, user, 15n, 2500n, r);
        const limit = 100_000_000n; // $100 card limit
        r.sigs.push(await send([createApproveInstruction(usdcAta(user.publicKey), cardAuthority.publicKey, user.publicKey, limit)], [admin, user]));
        const cards = new MockCardProvider();
        await cards.createCard({ owner: user.publicKey.toBase58(), holderName: "DEVNET TEST", network: "VISA" });
        const merchantAta = usdcAta(merchant);
        const before = await tokenBalance(merchantAta).catch(() => 0n);
        const ok = await cards.simulatePurchase({ owner: user.publicKey.toBase58(), merchant: "Albert Heijn", category: "Groceries", amountUsd6: 62_150_000n });
        expect(ok.status === "settled", `$62.15 purchase ${ok.status}${ok.declineReason ? ` (${ok.declineReason})` : ""}`);
        if (ok.settlementSig) r.sigs.push(ok.settlementSig);
        const after = await tokenBalance(merchantAta);
        expect(after - before === 62_150_000n, `merchant received ${usd(after - before)}, expected $62.15`);
        r.notes.push("$62.15 purchase settled on-chain, merchant received exactly $62.15 ✓");
        const over = await cards.simulatePurchase({ owner: user.publicKey.toBase58(), merchant: "MediaMarkt", category: "Electronics", amountUsd6: 50_000_000n });
        expect(over.status === "declined" && over.declineReason === "LIMIT", `$50 over the remaining $37.85 limit was ${over.status}${over.declineReason ? ` (${over.declineReason})` : ""}`);
        r.notes.push("$50 with $37.85 of limit left → declined LIMIT ✓");
        await closeOut(c, user, o.amount, r);
      },
    },
    {
      id: 19,
      name: "SEPA borrow + transfer in one tx",
      asset: "PRE-ANTHROPIC",
      group: "parallel",
      run: async (user, r) => {
        const c = await ctx("PRE-ANTHROPIC");
        const units = 2n;
        const amount = units * 10n ** BigInt(c.decimals);
        await ensureAtas(user.publicKey, c);
        await mintCollateral(c, user.publicKey, amount);
        r.sigs.push(await deposit(c, user, amount));
        const { rate } = await fetchEurRate();
        const usdc6 = eurToUsdc6(25_000, rate); // €250 at today's ECB rate
        const payoutAta = usdcAta(payoutAddress);
        const tx = new Transaction().add(
          createAssociatedTokenAccountIdempotentInstruction(user.publicKey, payoutAta, payoutAddress, usdcMint, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID),
          await borrowIx(c, user, usdc6).instruction(),
          createTransferCheckedInstruction(usdcAta(user.publicKey), usdcMint, payoutAta, user.publicKey, usdc6, 6, [], TOKEN_PROGRAM_ID),
        );
        tx.feePayer = admin.publicKey;
        const sig = await sendAndConfirmTransaction(connection, tx, [admin, user], { commitment: "confirmed" });
        r.sigs.push(sig);
        r.notes.push(`€250 at ${rate} → ${usd(usdc6)} borrowed and sent to PAYOUT_ADDRESS in one transaction`);
        const from = user.publicKey.toBase58();
        const to = payoutAddress.toBase58();
        const good = await verifyUsdcTransfer({ signature: sig, from, to, minAmount6: usdc6 });
        expect(good.ok, `verifyUsdcTransfer rejected a correct transfer: ${good.ok ? "" : good.reason}`);
        const tooMuch = await verifyUsdcTransfer({ signature: sig, from, to, minAmount6: usdc6 + 1n });
        expect(!tooMuch.ok, "verifyUsdcTransfer accepted 1 unit more than was sent");
        const wrongTo = await verifyUsdcTransfer({ signature: sig, from, to: merchant.toBase58(), minAmount6: usdc6 });
        expect(!wrongTo.ok, "verifyUsdcTransfer accepted the wrong destination");
        const wrongFrom = await verifyUsdcTransfer({ signature: sig, from: Keypair.generate().publicKey.toBase58(), to, minAmount6: usdc6 });
        expect(!wrongFrom.ok, "verifyUsdcTransfer accepted a transfer the claimed owner didn't sign");
        const garbage = await verifyUsdcTransfer({ signature: "not-a-signature", from, to, minAmount6: usdc6 });
        expect(!garbage.ok, "verifyUsdcTransfer accepted a garbage signature");
        r.notes.push("verify: correct ✓, +1 unit ✗, wrong destination ✗, wrong signer ✗, garbage ✗");
        await closeOut(c, user, amount, r);
      },
    },
    {
      id: 20,
      name: "interest + third-party repay",
      asset: "SPCX",
      group: "parallel",
      run: async (user, r) => {
        const c = await ctx("SPCX");
        const o = await openPosition(c, user, 10n, 3000n, r);
        await new Promise((res) => setTimeout(res, 8_000));
        const pos = await position(c, user.publicKey);
        const elapsed = BigInt(Math.floor(Date.now() / 1000) - Number(pos.lastAccrualTs));
        const owed = risk.accrue(BigInt(pos.debtPrincipal.toString()), BigInt(pos.aprBps), elapsed);
        expect(owed > o.debt, `no interest after ${elapsed}s (owed ${owed}, principal ${o.debt})`);
        r.notes.push(`after ${elapsed}s at ${pct(BigInt(pos.aprBps))}: owed ${usd(owed)} on ${usd(o.debt)}`);
        const half = o.debt / 2n;
        r.sigs.push(await repay(c, admin, user.publicKey, new anchor.BN(half.toString())));
        const afterThirdParty = await position(c, user.publicKey);
        const left = BigInt(afterThirdParty.debtPrincipal.toString());
        expect(left < o.debt && left > 0n, `third-party repay of ${usd(half)} left debt ${usd(left)}`);
        r.notes.push(`admin repaid ${usd(half)} on the user's behalf → ${usd(left)} left ✓`);
        await closeOut(c, user, o.amount, r);
      },
    },
  ];

  // Crash pair: set up both positions, crash once, check both, restore no matter what.
  const crashIds = [16, 17];
  const wantCrash = ONLY.length === 0 || ONLY.some((id) => crashIds.includes(id));

  // ---------- run ----------
  const selected = scenarios.filter((s) => ONLY.length === 0 || ONLY.includes(s.id));
  const totalWallets = selected.length + (wantCrash ? 2 : 0);
  const wallets = new Map<number, Keypair>();
  for (const s of selected) wallets.set(s.id, Keypair.generate());
  if (wantCrash) for (const id of crashIds) wallets.set(id, Keypair.generate());

  const adminSolBefore = await connection.getBalance(admin.publicKey);
  console.log(`admin ${admin.publicKey.toBase58()} · ${(adminSolBefore / LAMPORTS_PER_SOL).toFixed(3)} SOL · ${totalWallets} wallets`);
  if (adminSolBefore < totalWallets * FUND_LAMPORTS + 0.2 * LAMPORTS_PER_SOL) {
    throw new Error(`admin needs at least ${((totalWallets * FUND_LAMPORTS) / LAMPORTS_PER_SOL + 0.2).toFixed(2)} SOL`);
  }
  if (selected.some((s) => s.id === 18) && (await connection.getBalance(cardAuthority.publicKey)) < 0.01 * LAMPORTS_PER_SOL) {
    await send([SystemProgram.transfer({ fromPubkey: admin.publicKey, toPubkey: cardAuthority.publicKey, lamports: 20_000_000 })], [admin]);
    console.log("topped up card authority with 0.02 SOL (it pays card settlement fees)");
  }

  // Save the throwaway keys before funding, so a crash or a rate-limited sweep never strands SOL or
  // leaves a position nobody can close. Devnet-only test wallets; the folder is gitignored.
  const keyDir = path.join(ROOT, "scripts", ".test-wallets");
  fs.mkdirSync(keyDir, { recursive: true, mode: 0o700 });
  const keyFile = path.join(keyDir, `run-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(keyFile, JSON.stringify(Object.fromEntries([...wallets].map(([id, kp]) => [id, bs58.encode(kp.secretKey)])), null, 2), { mode: 0o600 });
  console.log(`test wallet keys: ${path.relative(ROOT, keyFile)}`);

  // Fund in batches of 10 transfers per transaction.
  const ids = [...wallets.keys()];
  for (let i = 0; i < ids.length; i += 10) {
    await send(
      ids.slice(i, i + 10).map((id) => SystemProgram.transfer({ fromPubkey: admin.publicKey, toPubkey: wallets.get(id)!.publicKey, lamports: FUND_LAMPORTS })),
      [admin],
    );
  }
  await ensureAtas(admin.publicKey); // liquidator + third-party repayer needs a USDC ATA
  console.log(`funded ${ids.length} wallets with ${FUND_LAMPORTS / LAMPORTS_PER_SOL} SOL each\n`);

  const results: Result[] = [];
  const runOne = async (s: Scenario) => {
    const r: Result = { id: s.id, name: s.name, asset: s.asset, status: "PASS", notes: [], sigs: [], ms: 0 };
    const t0 = Date.now();
    try {
      await s.run(wallets.get(s.id)!, r);
    } catch (e) {
      r.status = e instanceof Check && /price is stale/.test(e.message) ? "SKIP" : "FAIL";
      r.notes.push(e instanceof Check ? e.message : `unexpected: ${errorName(e)}`);
    }
    r.ms = Date.now() - t0;
    results.push(r);
    console.log(`${r.status.padEnd(4)} #${String(r.id).padStart(2)} ${r.name} · ${r.asset} (${(r.ms / 1000).toFixed(1)}s)`);
    for (const n of r.notes) console.log(`       ${n}`);
  };

  const queue = [...selected];
  await Promise.all(
    Array.from({ length: Math.max(1, CONCURRENCY) }, async () => {
      while (queue.length) await runOne(queue.shift()!);
    }),
  );

  if (wantCrash) await runCrash();

  async function runCrash() {
    const c = await ctx(CRASH_MARKET);
    const a = wallets.get(16)!;
    const b = wallets.get(17)!;
    const ra: Result = { id: 16, name: "crash → liquidation", asset: CRASH_MARKET, status: "PASS", notes: [], sigs: [], ms: 0 };
    const rb: Result = { id: 17, name: "crash, low LTV survives", asset: CRASH_MARKET, status: "PASS", notes: [], sigs: [], ms: 0 };
    const t0 = Date.now();

    const before = await priceView(c);
    let crashed = false; // set before the crash tx is sent, so an ambiguous failure still restores
    let restored = false;
    const restore = async () => {
      if (!crashed || restored) return;
      restored = true;
      const sig = await setPrice(c, before.priceUsd6, "market");
      console.log(`       restored ${CRASH_MARKET} to ${usd(before.priceUsd6)} (source market): ${EXPLORER(sig)}`);
    };
    const onSignal = () => {
      restore().finally(() => process.exit(130));
    };
    process.once("SIGINT", onSignal);

    try {
      // Safety: a crash can only hurt a position that has debt. Refuse if anyone else has debt here.
      const ours = new Set([a.publicKey.toBase58(), b.publicKey.toBase58()]);
      const onMarket = await retry(() => program.account.position.all([{ memcmp: { offset: 8 + 32, bytes: c.market.toBase58() } }]));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const exposed = (onMarket as any[]).filter((p) => !ours.has(p.account.owner.toBase58()) && BigInt(p.account.debtPrincipal.toString()) > 0n);
      if (exposed.length) {
        throw new Check(`${CRASH_MARKET} has ${exposed.length} position(s) with debt that aren't ours — not crashing a market real users borrow against`);
      }
      if (before.source === "demo") {
        throw new Check(`${CRASH_MARKET} is already under a Demo override — not stacking a crash on top of it`);
      }
      if (before.haircut === null) throw new Check(`${CRASH_MARKET} price is stale (${Math.round(before.age / 60)} min old)`);

      // About $2,000 of collateral per wallet, whatever the market's price.
      const units = (2_000_000_000n + before.priceUsd6 - 1n) / before.priceUsd6;
      const oa = await openPosition(c, a, units, 2900n, ra);
      const ob = await openPosition(c, b, units, 1000n, rb);
      await ensureAtas(admin.publicKey, c); // the liquidator receives the seized collateral here
      const liqThreshold = BigInt(c.m.liqThresholdBps);

      await expectError("liquidate healthy 29% position", () => liquidate(c, a.publicKey, 1_000_000n), "NotLiquidatable", ra.notes);

      const crashPrice = (before.priceUsd6 * 60n) / 100n;
      crashed = true;
      ra.sigs.push(await setPrice(c, crashPrice, "demo"));
      ra.notes.push(`crash: ${usd(before.priceUsd6)} → ${usd(crashPrice)} (−40%, source demo)`);

      const valueA = await valueUsd6(c, oa.amount);
      const ltvA = risk.ltvBps(oa.debt, valueA);
      expect(ltvA > liqThreshold, `after the crash A is at ${pct(ltvA)}, not above the ${pct(liqThreshold)} threshold — scenario mis-sized`);
      ra.notes.push(`A now ${pct(ltvA)} > ${pct(liqThreshold)} liquidation threshold`);

      const posA = await position(c, a.publicKey);
      const debtNow = BigInt(posA.debtPrincipal.toString());
      const closeMax = (debtNow * BigInt(onchainConfig.closeFactorBps)) / BPS;
      await expectError(`liquidate ${usd(closeMax + 1_000_000n)} (over ${pct(BigInt(onchainConfig.closeFactorBps))} close factor)`, () => liquidate(c, a.publicKey, closeMax + 1_000_000n), "ExceedsCloseFactor", ra.notes);

      ra.sigs.push(await liquidate(c, a.publicKey, closeMax));
      const afterA = await position(c, a.publicKey);
      const debtAfter = BigInt(afterA.debtPrincipal.toString());
      const collAfter = BigInt(afterA.collateralAmount.toString());
      const ltvAfter = risk.ltvBps(debtAfter, await valueUsd6(c, collAfter));
      expect(debtAfter < debtNow && collAfter < oa.amount, "liquidation didn't reduce both debt and collateral");
      expect(ltvAfter < liqThreshold, `after liquidation A is still at ${pct(ltvAfter)}`);
      ra.notes.push(`liquidated ${usd(closeMax)}: seized ${risk.formatTokens(oa.amount - collAfter, c.decimals)} ${CRASH_MARKET}, A back to ${pct(ltvAfter)} ✓`);
      await expectError("second liquidation", () => liquidate(c, a.publicKey, 1_000_000n), "NotLiquidatable", ra.notes);

      const ltvB = risk.ltvBps(ob.debt, await valueUsd6(c, ob.amount));
      rb.notes.push(`B at 10% before the crash is at ${pct(ltvB)} after it`);
      await expectError("liquidate B", () => liquidate(c, b.publicKey, 1_000_000n), "NotLiquidatable", rb.notes);

      await restore();
      await closeOut(c, a, collAfter, ra); // what's left after the seizure comes back to A
      await closeOut(c, b, ob.amount, rb);
    } catch (e) {
      const msg = e instanceof Check ? e.message : `unexpected: ${errorName(e)}`;
      const skip = e instanceof Check && /not crashing|not stacking|price is stale/.test(e.message);
      for (const r of [ra, rb]) {
        if (r.status === "PASS") {
          r.status = skip ? "SKIP" : "FAIL";
          r.notes.push(msg);
        }
      }
    } finally {
      await restore().catch((e) => {
        console.error(`!! COULD NOT RESTORE ${CRASH_MARKET} PRICE — run /api/prices/sync or set it by hand: ${errorName(e)}`);
      });
      process.removeListener("SIGINT", onSignal);
    }
    ra.ms = rb.ms = Date.now() - t0;
    for (const r of [ra, rb]) {
      results.push(r);
      console.log(`${r.status.padEnd(4)} #${r.id} ${r.name} · ${r.asset} (${(r.ms / 1000).toFixed(1)}s)`);
      for (const n of r.notes) console.log(`       ${n}`);
    }
  }

  // ---------- sweep ----------
  if (!KEEP) {
    let swept = 0;
    const stuck: string[] = [];
    for (const kp of wallets.values()) {
      const lamports = (await retry(() => connection.getBalance(kp.publicKey))) - 5_000;
      if (lamports <= 0) continue;
      try {
        await retry(() => sendAndConfirmTransaction(connection, new Transaction().add(SystemProgram.transfer({ fromPubkey: kp.publicKey, toPubkey: admin.publicKey, lamports })), [kp], { commitment: "confirmed" }));
        swept += lamports;
      } catch (e) {
        stuck.push(`${kp.publicKey.toBase58()} (${errorName(e)})`);
      }
    }
    console.log(`\nswept ${(swept / LAMPORTS_PER_SOL).toFixed(4)} SOL back to admin`);
    if (stuck.length) console.log(`could not sweep ${stuck.length} wallet(s); keys are in ${path.relative(ROOT, keyFile)}:\n  ${stuck.join("\n  ")}`);
  }
  const adminSolAfter = await connection.getBalance(admin.publicKey);

  // ---------- summary ----------
  results.sort((x, y) => x.id - y.id);
  const count = (s: Status) => results.filter((r) => r.status === s).length;
  const cost = (adminSolBefore - adminSolAfter) / LAMPORTS_PER_SOL;
  console.log(`\n${count("PASS")} passed · ${count("FAIL")} failed · ${count("SKIP")} skipped · run cost ${cost.toFixed(4)} SOL`);
  for (const r of results.filter((x) => x.status === "FAIL")) {
    console.log(`  #${r.id} ${r.name}: ${r.notes.at(-1)}`);
    for (const sig of r.sigs.slice(-2)) console.log(`     ${EXPLORER(sig)}`);
  }

  if (REPORT) {
    const lines = [
      "# StockCard devnet run",
      "",
      `Generated by \`scripts/devnet-wallets.ts\` on ${new Date().toISOString()} against program \`${programId.toBase58()}\` (devnet).`,
      "",
      `**${count("PASS")} passed · ${count("FAIL")} failed · ${count("SKIP")} skipped** across ${results.length} fresh wallets · run cost ${cost.toFixed(4)} SOL.`,
      "",
      "| # | Scenario | Asset | Result | What happened |",
      "|---|---|---|---|---|",
      ...results.map((r) => `| ${r.id} | ${r.name} | ${r.asset} | ${r.status} | ${r.notes.join("<br>").replace(/\|/g, "\\|")} |`),
      "",
      "Transactions (first per scenario):",
      "",
      ...results.filter((r) => r.sigs[0]).map((r) => `- #${r.id}: [${r.sigs[0].slice(0, 12)}…](${EXPLORER(r.sigs[0])})`),
      "",
    ];
    fs.mkdirSync(path.dirname(path.resolve(ROOT, REPORT)), { recursive: true });
    fs.writeFileSync(path.resolve(ROOT, REPORT), lines.join("\n"));
    console.log(`report: ${REPORT}`);
  }

  process.exit(count("FAIL") ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
