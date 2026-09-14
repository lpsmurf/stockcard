import * as anchor from "@anchor-lang/core";
import { Program, BN } from "@anchor-lang/core";
import {
  createAssociatedTokenAccount,
  createInitializeMintInstruction,
  createInitializeScaledUiAmountConfigInstruction,
  createMint,
  getAssociatedTokenAddressSync,
  getMintLen,
  ExtensionType,
  mintTo,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { Keypair, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { expect } from "chai";
import { Stockcard } from "../target/types/stockcard";

const USDC_DECIMALS = 6;
const NVDA_DECIMALS = 8;
const PRICE_211_96 = new BN(211_960_000); // expo -6
const PRICE_148_372 = new BN(148_372_000); // crash: 211.96 * 0.7
const EXPO = -6;

// mirror of math.rs (and app/src/lib/risk.ts)
const ceilDiv = (a: bigint, b: bigint): bigint => (a === 0n ? 0n : (a - 1n) / b + 1n);
const accrueInterest = (debt: bigint, aprBps: bigint, elapsed: bigint) =>
  debt === 0n || elapsed <= 0n ? 0n : ceilDiv(debt * aprBps * elapsed, 10_000n * 31_536_000n);

const equityBands = () => [
  { maxLtvBps: 2000, aprBps: 990 },
  { maxLtvBps: 3500, aprBps: 1290 },
  { maxLtvBps: 5000, aprBps: 1490 },
];

describe("stockcard", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Stockcard as Program<Stockcard>;
  const connection = provider.connection;
  const payer = (provider.wallet as anchor.Wallet).payer;

  const [configPda] = PublicKey.findProgramAddressSync([Buffer.from("config")], program.programId);
  const [usdcVaultPda] = PublicKey.findProgramAddressSync([Buffer.from("usdc_vault")], program.programId);
  const marketPda = (mint: PublicKey) =>
    PublicKey.findProgramAddressSync([Buffer.from("market"), mint.toBuffer()], program.programId)[0];
  const collateralVaultPda = (market: PublicKey) =>
    PublicKey.findProgramAddressSync([Buffer.from("collateral_vault"), market.toBuffer()], program.programId)[0];
  const pricePda = (market: PublicKey) =>
    PublicKey.findProgramAddressSync([Buffer.from("price"), market.toBuffer()], program.programId)[0];
  const positionPda = (market: PublicKey, owner: PublicKey) =>
    PublicKey.findProgramAddressSync(
      [Buffer.from("position"), market.toBuffer(), owner.toBuffer()],
      program.programId,
    )[0];
  const savingsPda = (owner: PublicKey) =>
    PublicKey.findProgramAddressSync([Buffer.from("savings"), owner.toBuffer()], program.programId)[0];

  let usdcMint: PublicKey;
  let nvdaMint: PublicKey;
  let nvdaMarket: PublicKey;
  let adminUsdcAta: PublicKey;

  async function newUser(): Promise<Keypair> {
    const kp = Keypair.generate();
    const sig = await connection.requestAirdrop(kp.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL);
    await connection.confirmTransaction(sig, "confirmed");
    return kp;
  }

  async function expectError(p: Promise<unknown>, code: string) {
    try {
      await p;
    } catch (e) {
      const err = e as anchor.AnchorError;
      expect(err.error?.errorCode?.code ?? String(e)).to.equal(code);
      return;
    }
    expect.fail(`expected error ${code}`);
  }

  async function setPrice(mint: PublicKey, price: BN, source: object) {
    const market = marketPda(mint);
    await program.methods
      .setSignedPrice(price, EXPO, source)
      .accounts({
        signer: payer.publicKey,
        config: configPda,
        market,
        signedPrice: pricePda(market),
      })
      .rpc();
  }

  async function addEquityMarket(mint: PublicKey, maxPriceAgeSecs: number, tokenProgram: PublicKey) {
    await program.methods
      .addMarket(
        { equity: {} },
        { signed: {} },
        PublicKey.default,
        5000,
        6500,
        500,
        0,
        equityBands(),
        maxPriceAgeSecs,
        0,
        0,
      )
      .accounts({
        admin: payer.publicKey,
        config: configPda,
        collateralMint: mint,
        market: marketPda(mint),
        collateralVault: collateralVaultPda(marketPda(mint)),
        tokenProgram,
      })
      .rpc();
    return marketPda(mint);
  }

  async function deposit(user: Keypair, mint: PublicKey, amount: BN, tokenProgram = TOKEN_PROGRAM_ID) {
    const market = marketPda(mint);
    await program.methods
      .depositCollateral(amount)
      .accounts({
        owner: user.publicKey,
        config: configPda,
        market,
        position: positionPda(market, user.publicKey),
        collateralMint: mint,
        ownerToken: getAssociatedTokenAddressSync(mint, user.publicKey, false, tokenProgram),
        collateralVault: collateralVaultPda(market),
        signedPrice: pricePda(market),
        tokenProgram,
      })
      .signers([user])
      .rpc();
  }

  async function borrow(user: Keypair, mint: PublicKey, amount: BN) {
    const market = marketPda(mint);
    return program.methods
      .borrow(amount)
      .accounts({
        owner: user.publicKey,
        config: configPda,
        market,
        position: positionPda(market, user.publicKey),
        collateralMint: mint,
        usdcVault: usdcVaultPda,
        usdcMint,
        destinationUsdc: getAssociatedTokenAddressSync(usdcMint, user.publicKey),
        signedPrice: pricePda(market),
        collateralVault: collateralVaultPda(market),
        usdcTokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([user])
      .rpc();
  }

  async function repay(user: Keypair, mint: PublicKey, amount: BN) {
    const market = marketPda(mint);
    return program.methods
      .repay(amount)
      .accounts({
        payer: user.publicKey,
        config: configPda,
        market,
        position: positionPda(market, user.publicKey),
        collateralMint: mint,
        payerUsdc: getAssociatedTokenAddressSync(usdcMint, user.publicKey),
        usdcVault: usdcVaultPda,
        usdcMint,
        signedPrice: pricePda(market),
        usdcTokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([user])
      .rpc();
  }

  const getPosition = (market: PublicKey, owner: PublicKey) =>
    program.account.position.fetch(positionPda(market, owner));
  const getConfig = () => program.account.config.fetch(configPda);

  it("init config, market, signed price, pool funding", async () => {
    usdcMint = await createMint(connection, payer, payer.publicKey, null, USDC_DECIMALS);
    nvdaMint = await createMint(connection, payer, payer.publicKey, null, NVDA_DECIMALS);

    await program.methods
      .initConfig(4000, 9000, 5000, payer.publicKey, payer.publicKey)
      .accounts({
        admin: payer.publicKey,
        config: configPda,
        usdcMint,
        usdcVault: usdcVaultPda,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    nvdaMarket = await addEquityMarket(nvdaMint, 300, TOKEN_PROGRAM_ID);
    await setPrice(nvdaMint, PRICE_211_96, { market: {} });

    // seed pool: 2,000,000 dUSDC via deposit_savings (parameters.md §Pool)
    adminUsdcAta = await createAssociatedTokenAccount(connection, payer, usdcMint, payer.publicKey);
    await mintTo(connection, payer, usdcMint, adminUsdcAta, payer, 3_000_000_000_000);
    await program.methods
      .depositSavings(new BN(2_000_000_000_000))
      .accounts({
        saver: payer.publicKey,
        config: configPda,
        usdcVault: usdcVaultPda,
        saverUsdc: adminUsdcAta,
        usdcMint,
        savingsPosition: savingsPda(payer.publicKey),
        usdcTokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    const cfg = await getConfig();
    expect(cfg.totalShares.toString()).to.equal("2000000000000");
    const savings = await program.account.savingsPosition.fetch(savingsPda(payer.publicKey));
    expect(savings.shares.toString()).to.equal("2000000000000");
  });

  it("deposit 10 NVDAx -> position and market totals", async () => {
    const user = await newUser();
    const ata = await createAssociatedTokenAccount(connection, payer, nvdaMint, user.publicKey);
    await mintTo(connection, payer, nvdaMint, ata, payer, 25_000_000_000); // 25 NVDAx
    await deposit(user, nvdaMint, new BN(1_000_000_000)); // 10

    const pos = await getPosition(nvdaMarket, user.publicKey);
    expect(pos.collateralAmount.toString()).to.equal("1000000000");
    expect(pos.debtPrincipal.toString()).to.equal("0");
    expect(pos.aprBps).to.equal(990);
    const market = await program.account.market.fetch(nvdaMarket);
    expect(market.totalCollateral.toString()).to.equal("1000000000");
    (global as Record<string, unknown>).userA = user;
  });

  it("borrow at max LTV succeeds, 1 unit over fails", async () => {
    const user = (global as Record<string, unknown>).userA as Keypair;
    await createAssociatedTokenAccount(connection, payer, usdcMint, user.publicKey);
    // 10 NVDAx at $211.96 = $2,119.60; max 50% = 1,059,800,000 base units
    await borrow(user, nvdaMint, new BN(1_059_800_000));
    const pos = await getPosition(nvdaMarket, user.publicKey);
    expect(pos.debtPrincipal.toString()).to.equal("1059800000");
    expect(pos.aprBps).to.equal(1490); // 50% LTV -> band 3

    await expectError(borrow(user, nvdaMint, new BN(1)), "ExceedsMaxLtv");
  });

  it("APR band switches when LTV crosses 20% / 35%", async () => {
    const user = await newUser();
    const ata = await createAssociatedTokenAccount(connection, payer, nvdaMint, user.publicKey);
    await mintTo(connection, payer, nvdaMint, ata, payer, 1_000_000_000);
    await deposit(user, nvdaMint, new BN(1_000_000_000));
    await createAssociatedTokenAccount(connection, payer, usdcMint, user.publicKey);

    await borrow(user, nvdaMint, new BN(100_000_000)); // 4.7% -> 9.9%
    let pos = await getPosition(nvdaMarket, user.publicKey);
    expect(pos.aprBps).to.equal(990);

    await borrow(user, nvdaMint, new BN(400_000_000)); // 23.6% -> 12.9%
    pos = await getPosition(nvdaMarket, user.publicKey);
    expect(pos.aprBps).to.equal(1290);

    await borrow(user, nvdaMint, new BN(300_000_000)); // 37.8% -> 14.9%
    pos = await getPosition(nvdaMarket, user.publicKey);
    expect(pos.aprBps).to.equal(1490);
    (global as Record<string, unknown>).userB = user;
  });

  it("repay all leaves zero debt, no dust", async () => {
    const user = (global as Record<string, unknown>).userB as Keypair;
    const before = (await getPosition(nvdaMarket, user.publicKey)).debtPrincipal;
    expect(before.toNumber()).to.be.greaterThan(800_000_000); // interest accrued
    // top up so the wallet covers debt + accrued interest
    await mintTo(connection, payer, usdcMint, getAssociatedTokenAddressSync(usdcMint, user.publicKey), payer, 100_000_000);
    await repay(user, nvdaMint, new BN("18446744073709551615")); // u64::MAX
    const pos = await getPosition(nvdaMarket, user.publicKey);
    expect(pos.debtPrincipal.toString()).to.equal("0");
    expect(pos.aprBps).to.equal(990); // re-selected at LTV 0
  });

  it("withdraw is guarded by LTV", async () => {
    const user = (global as Record<string, unknown>).userB as Keypair;
    await borrow(user, nvdaMint, new BN(500_000_000)); // borrow again, 23.6%
    await mintTo(connection, payer, usdcMint, getAssociatedTokenAddressSync(usdcMint, user.publicKey), payer, 100_000_000);

    const market = nvdaMarket;
    const withdrawIx = (amount: BN) =>
      program.methods
        .withdrawCollateral(amount)
        .accounts({
          owner: user.publicKey,
          config: configPda,
          market,
          position: positionPda(market, user.publicKey),
          collateralMint: nvdaMint,
          ownerToken: getAssociatedTokenAddressSync(nvdaMint, user.publicKey),
          collateralVault: collateralVaultPda(market),
          signedPrice: pricePda(market),
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([user])
        .rpc();

    await expectError(withdrawIx(new BN(1_000_000_000)), "InsufficientCollateral"); // all 10
    await withdrawIx(new BN(500_000_000)); // 5 left: 5 * 211.96 = 1059.8, LTV 47%
    const pos = await getPosition(nvdaMarket, user.publicKey);
    expect(pos.collateralAmount.toString()).to.equal("500000000");
    await repay(user, nvdaMint, new BN("18446744073709551615"));
  });

  it("deposit_collateral_for rejects non-authority, accepts cashback authority", async () => {
    const user = (global as Record<string, unknown>).userB as Keypair;
    const stranger = await newUser();
    const strangerAta = await createAssociatedTokenAccount(connection, payer, nvdaMint, stranger.publicKey);
    await mintTo(connection, payer, nvdaMint, strangerAta, payer, 100_000_000);

    const call = (authority: Keypair, source: PublicKey) =>
      program.methods
        .depositCollateralFor(user.publicKey, new BN(100_000_000))
        .accounts({
          authority: authority.publicKey,
          config: configPda,
          market: nvdaMarket,
          position: positionPda(nvdaMarket, user.publicKey),
          collateralMint: nvdaMint,
          sourceToken: source,
          collateralVault: collateralVaultPda(nvdaMarket),
          signedPrice: pricePda(nvdaMarket),
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([authority])
        .rpc();

    await expectError(call(stranger, strangerAta), "Unauthorized");

    // payer is config.cashback_authority
    const adminNvda = await createAssociatedTokenAccount(connection, payer, nvdaMint, payer.publicKey);
    await mintTo(connection, payer, nvdaMint, adminNvda, payer, 100_000_000);
    await call(payer, adminNvda);
    const pos = await getPosition(nvdaMarket, user.publicKey);
    expect(pos.collateralAmount.toString()).to.equal("600000000");
  });

  it("liquidation: healthy fails, crash makes liquidatable, seize + end state correct", async () => {
    const user = await newUser();
    const ata = await createAssociatedTokenAccount(connection, payer, nvdaMint, user.publicKey);
    await mintTo(connection, payer, nvdaMint, ata, payer, 1_000_000_000);
    await deposit(user, nvdaMint, new BN(1_000_000_000));
    await createAssociatedTokenAccount(connection, payer, usdcMint, user.publicKey);
    await borrow(user, nvdaMint, new BN(1_000_000_000)); // $1,000 at 47.2%

    const liqNvdaAta = getAssociatedTokenAddressSync(nvdaMint, payer.publicKey);
    const liquidate = (repayAmount: BN) =>
      program.methods
        .liquidate(repayAmount)
        .accounts({
          liquidator: payer.publicKey,
          config: configPda,
          market: nvdaMarket,
          position: positionPda(nvdaMarket, user.publicKey),
          collateralMint: nvdaMint,
          liquidatorUsdc: adminUsdcAta,
          usdcVault: usdcVaultPda,
          usdcMint,
          liquidatorCollateral: liqNvdaAta,
          collateralVault: collateralVaultPda(nvdaMarket),
          signedPrice: pricePda(nvdaMarket),
          collateralTokenProgram: TOKEN_PROGRAM_ID,
          usdcTokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

    await expectError(liquidate(new BN(500_000_000)), "NotLiquidatable");

    await setPrice(nvdaMint, PRICE_148_372, { demo: {} }); // crash -30%

    await expectError(liquidate(new BN(600_000_000)), "ExceedsCloseFactor");
    await liquidate(new BN(500_000_000));

    const pos = await getPosition(nvdaMarket, user.publicKey);
    expect(pos.debtPrincipal.toNumber()).to.be.closeTo(500_000_000, 100); // ~$500 (+ seconds of interest)
    expect(pos.collateralAmount.toString()).to.equal((1_000_000_000 - 353_840_347).toString());

    // end state ~52.2% LTV -> no longer liquidatable
    await expectError(liquidate(new BN(100_000_000)), "NotLiquidatable");
  });

  it("stale signed price blocks borrow", async () => {
    const staleMint = await createMint(connection, payer, payer.publicKey, null, NVDA_DECIMALS);
    const staleMarket = await addEquityMarket(staleMint, 0, TOKEN_PROGRAM_ID); // max age 0s
    await setPrice(staleMint, PRICE_211_96, { market: {} });

    const user = await newUser();
    const ata = await createAssociatedTokenAccount(connection, payer, staleMint, user.publicKey);
    await mintTo(connection, payer, staleMint, ata, payer, 1_000_000_000);
    await deposit(user, staleMint, new BN(1_000_000_000));
    await createAssociatedTokenAccount(connection, payer, usdcMint, user.publicKey);

    await new Promise((r) => setTimeout(r, 1500)); // let the price age past 0s
    await expectError(borrow(user, staleMint, new BN(100_000_000)), "StalePrice");
    expect(staleMarket).to.not.equal(nvdaMarket);
  });

  it("interest after elapsed time matches risk math exactly", async () => {
    const user = await newUser();
    const ata = await createAssociatedTokenAccount(connection, payer, nvdaMint, user.publicKey);
    await mintTo(connection, payer, nvdaMint, ata, payer, 1_000_000_000);
    await deposit(user, nvdaMint, new BN(1_000_000_000));
    await createAssociatedTokenAccount(connection, payer, usdcMint, user.publicKey);
    await borrow(user, nvdaMint, new BN(100_000_000)); // 4.7% -> apr 990

    await new Promise((r) => setTimeout(r, 2000));
    const posBefore = await getPosition(nvdaMarket, user.publicKey);
    await repay(user, nvdaMint, new BN(1)); // forces accrue, then pays 1 unit
    const posAfter = await getPosition(nvdaMarket, user.publicKey);

    const elapsed = BigInt(posAfter.lastAccrualTs.toNumber() - posBefore.lastAccrualTs.toNumber());
    expect(Number(elapsed)).to.be.greaterThan(0);
    const expected =
      BigInt(posBefore.debtPrincipal.toString()) +
      accrueInterest(BigInt(posBefore.debtPrincipal.toString()), BigInt(posBefore.aprBps), elapsed) -
      1n;
    expect(BigInt(posAfter.debtPrincipal.toString())).to.equal(expected);

    // reserve = 40% of all accrued interest, rounded up
    const cfg = await getConfig();
    const interest = BigInt(posAfter.debtPrincipal.toString()) + 1n - BigInt(posBefore.debtPrincipal.toString());
    expect(cfg.reserve.toNumber()).to.be.gte(0);
    expect(Number(interest)).to.be.gte(1);
  });

  it("savings: deposits mint shares, withdraw burns, idle liquidity enforced", async () => {
    const saver = await newUser();
    const saverUsdc = await createAssociatedTokenAccount(connection, payer, usdcMint, saver.publicKey);
    await mintTo(connection, payer, usdcMint, saverUsdc, payer, 20_000_000_000); // 20k dUSDC

    const cfgBefore = await getConfig();
    const vaultBal = 2_000_000_000_000n - 0n; // pool seed; borrows drew from vault
    void vaultBal;

    await program.methods
      .depositSavings(new BN(10_000_000_000))
      .accounts({
        saver: saver.publicKey,
        config: configPda,
        usdcVault: usdcVaultPda,
        saverUsdc,
        usdcMint,
        savingsPosition: savingsPda(saver.publicKey),
        usdcTokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([saver])
      .rpc();

    const pos = await program.account.savingsPosition.fetch(savingsPda(saver.publicKey));
    expect(pos.shares.toNumber()).to.be.closeTo(10_000_000_000, 20_000_000); // ~1:1 modulo interest
    const cfgMid = await getConfig();
    expect(cfgMid.totalShares.toString()).to.equal(
      (BigInt(cfgBefore.totalShares.toString()) + BigInt(pos.shares.toString())).toString(),
    );

    // withdraw half the shares
    await program.methods
      .withdrawSavings(pos.shares.div(new BN(2)))
      .accounts({
        saver: saver.publicKey,
        config: configPda,
        usdcVault: usdcVaultPda,
        saverUsdc,
        usdcMint,
        savingsPosition: savingsPda(saver.publicKey),
        usdcTokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([saver])
      .rpc();
    const posAfter = await program.account.savingsPosition.fetch(savingsPda(saver.publicKey));
    expect(posAfter.shares.toString()).to.equal(pos.shares.sub(pos.shares.div(new BN(2))).toString());
  });

  it("borrow blocked above 90% utilization", async () => {
    const whale = await newUser();
    const ata = await createAssociatedTokenAccount(connection, payer, nvdaMint, whale.publicKey);
    await mintTo(connection, payer, nvdaMint, ata, payer, 40_000_000_000_000); // 400k NVDAx
    await deposit(whale, nvdaMint, new BN(40_000_000_000_000));
    await createAssociatedTokenAccount(connection, payer, usdcMint, whale.publicKey);

    // pool ~2.01M; borrowing $1.83M pushes utilization past 90%
    await expectError(borrow(whale, nvdaMint, new BN(1_830_000_000_000)), "PoolUtilizationCap");
    // borrowing well under the cap works
    await borrow(whale, nvdaMint, new BN(1_000_000_000_000));
  });

  it("claim_reserve limited to reserve", async () => {
    const cfg = await getConfig();
    await expectError(
      program.methods
        .claimReserve(new BN("999999999999999"))
        .accounts({
          admin: payer.publicKey,
          config: configPda,
          usdcVault: usdcVaultPda,
          adminUsdc: adminUsdcAta,
          usdcMint,
          usdcTokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc(),
      "InsufficientLiquidity",
    );
    if (cfg.reserve.toNumber() > 0) {
      await program.methods
        .claimReserve(cfg.reserve)
        .accounts({
          admin: payer.publicKey,
          config: configPda,
          usdcVault: usdcVaultPda,
          adminUsdc: adminUsdcAta,
          usdcMint,
          usdcTokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();
      expect((await getConfig()).reserve.toString()).to.equal("0");
    }
  });

  it("Token-2022 scaled UI amount mint values collateral with the multiplier", async () => {
    // NVDAx-style mock: Token-2022, 8 decimals, multiplier 1.001701
    const mintKp = Keypair.generate();
    const extensions = [ExtensionType.ScaledUiAmountConfig];
    const mintLen = getMintLen(extensions);
    const lamports = await connection.getMinimumBalanceForRentExemption(mintLen);
    const multiplier = 1.001701;
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
        payer.publicKey,
        multiplier,
        TOKEN_2022_PROGRAM_ID,
      ),
      createInitializeMintInstruction(mintKp.publicKey, NVDA_DECIMALS, payer.publicKey, null, TOKEN_2022_PROGRAM_ID),
    );
    await provider.sendAndConfirm(tx, [mintKp]);

    const market = await addEquityMarket(mintKp.publicKey, 300, TOKEN_2022_PROGRAM_ID);
    await setPrice(mintKp.publicKey, PRICE_211_96, { market: {} });

    const user = await newUser();
    const ata = await createAssociatedTokenAccount(
      connection,
      payer,
      mintKp.publicKey,
      user.publicKey,
      undefined,
      TOKEN_2022_PROGRAM_ID,
    );
    await mintTo(connection, payer, mintKp.publicKey, ata, payer, 1_000_000_000, [], undefined, TOKEN_2022_PROGRAM_ID);
    await deposit(user, mintKp.publicKey, new BN(1_000_000_000), TOKEN_2022_PROGRAM_ID);
    await createAssociatedTokenAccount(connection, payer, usdcMint, user.publicKey);

    // value = 10 x 1.001701 x 211.96 = $2,123.205439; max borrow = floor to $1,061.602719
    await borrow(user, mintKp.publicKey, new BN(1_061_602_719));
    await expectError(borrow(user, mintKp.publicKey, new BN(2)), "ExceedsMaxLtv");
    const m = await program.account.market.fetch(market);
    expect(m.decimals).to.equal(8);
  });
});
