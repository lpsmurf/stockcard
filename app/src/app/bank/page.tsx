"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BN } from "@anchor-lang/core";
import { PublicKey, Transaction } from "@solana/web3.js";
import { createAssociatedTokenAccountInstruction, createTransferCheckedInstruction, getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { AmountInput } from "@/components/amount-input";
import { PreviewRow } from "@/components/preview-row";
import { Sheet } from "@/components/sheet";
import { useToast } from "@/components/toast";
import { useWalletAuth } from "@/lib/wallet-auth";
import { useProgram } from "@/lib/program";
import { usePortfolio, type PortfolioAsset } from "@/lib/portfolio";
import { collateralVaultPda, configPda, positionPda, usdcVaultPda } from "@/lib/program";
import { USDC_MINT } from "@/lib/config";
import { formatIban, normalizeIban, validateIban } from "@/lib/iban";
import { availableCredit, formatPct, formatUsd, liquidationPrice, ltvBps, selectAprBps } from "@/lib/risk";

/** Mirror of lib/payout/provider.ts shapes (the API returns these). */
interface BankAccount {
  id: string;
  holderName: string;
  last4: string;
  country: string;
  bic?: string;
}
interface Quote {
  quoteId: string;
  bankAccountId: string;
  eurCents: number;
  usdc6: string;
  rate: number;
  providerFeeCents: number;
  stockcardFeeCents: number;
  receiveCents: number;
  payoutAddress: string;
  rail: "sepa_instant" | "sepa";
  eta: string;
  expiresAt: number;
}
interface Payout {
  id: string;
  bankLast4: string;
  eurCents: number;
  status: "processing" | "arrived" | "failed" | "returned";
  transferSig: string;
  sepaReference: string;
}

const PURPOSES = ["Car", "Home", "Tax", "Other"] as const;
const PURPOSE_REQUIRED_ABOVE_CENTS = 1_000_000;

const eur = (cents: number) =>
  `€${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function BankPage() {
  return (
    <Suspense>
      <BankSheet />
    </Suspense>
  );
}

function BankSheet() {
  const params = useSearchParams();
  const router = useRouter();
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const program = useProgram();
  const walletAuth = useWalletAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: assets } = usePortfolio();

  const [source, setSource] = useState<"borrow" | "balance">(params.get("source") === "balance" ? "balance" : "borrow");
  const [amountStr, setAmountStr] = useState("");
  const [accountId, setAccountId] = useState<string | null>(null);
  const [purpose, setPurpose] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Payout | null>(null);

  const eurCents = (() => {
    const n = Number(amountStr);
    return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0;
  })();

  const accountsQuery = useQuery({
    queryKey: ["bank-accounts", publicKey?.toBase58()],
    enabled: !!publicKey,
    queryFn: async () => {
      const res = await fetch("/api/bank-accounts", { headers: await walletAuth("/api/bank-accounts") });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error?.message ?? "Failed to load bank accounts");
      return json.data as BankAccount[];
    },
  });
  const accounts = accountsQuery.data ?? [];
  const account = accounts.find((a) => a.id === accountId) ?? accounts[0];

  // Borrow source: position with the most headroom backs the payout.
  const borrowAsset: PortfolioAsset | undefined = useMemo(() => {
    const list = (assets ?? []).filter((a) => a.deposited > 0n && a.priceUsd6 > 0n);
    return [...list].sort(
      (a, b) =>
        Number(availableCredit(b.debt, b.valueUsd6, BigInt(b.info.maxLtvBps)) - availableCredit(a.debt, a.valueUsd6, BigInt(a.info.maxLtvBps))),
    )[0];
  }, [assets]);

  const quoteQuery = useQuery({
    queryKey: ["payout-quote", account?.id, eurCents, source],
    enabled: !!publicKey && !!account && eurCents >= 1000,
    queryFn: async () => {
      const res = await fetch("/api/payouts/quote", {
        method: "POST",
        headers: await walletAuth("/api/payouts/quote"),
        body: JSON.stringify({ bankAccountId: account!.id, eurCents, source }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error?.message ?? "Quote failed");
      return json.data as Quote;
    },
  });
  const quote = quoteQuery.data ?? null;

  // Poll the payout status after signing (mock advances it on read).
  useQuery({
    queryKey: ["payouts", publicKey?.toBase58()],
    enabled: !!publicKey && !!done && done.status === "processing",
    refetchInterval: 4000,
    queryFn: async () => {
      const res = await fetch("/api/payouts", { headers: await walletAuth("/api/payouts") });
      const json = await res.json();
      const list = (json.data ?? []) as Payout[];
      const hit = list.find((p) => p.id === done!.id);
      if (hit && hit.status !== done!.status) setDone(hit);
      return list;
    },
  });

  const usdc6 = quote ? BigInt(quote.usdc6) : 0n;

  const preview = useMemo(() => {
    if (source !== "borrow" || !borrowAsset || usdc6 <= 0n) return null;
    const newDebt = borrowAsset.debt + usdc6;
    const ltv = ltvBps(newDebt, borrowAsset.valueUsd6);
    const overMax = usdc6 > availableCredit(borrowAsset.debt, borrowAsset.valueUsd6, BigInt(borrowAsset.info.maxLtvBps));
    const apr = selectAprBps(borrowAsset.info.aprBands, ltv);
    const liqPx = liquidationPrice(
      newDebt,
      borrowAsset.deposited,
      borrowAsset.info.multiplierMicro,
      BigInt(borrowAsset.info.haircutBps),
      BigInt(borrowAsset.info.liqThresholdBps),
      borrowAsset.info.decimals,
    );
    return { newDebt, ltv, overMax, apr, liqPx };
  }, [source, borrowAsset, usdc6]);

  async function confirm() {
    if (!publicKey || !account || !quote || !sendTransaction) return;
    setBusy(true);
    try {
      // Re-quote so the rate and payout address are fresh (quotes live 60 s).
      const qres = await fetch("/api/payouts/quote", {
        method: "POST",
        headers: await walletAuth("/api/payouts/quote"),
        body: JSON.stringify({ bankAccountId: account.id, eurCents, source }),
      });
      const qjson = await qres.json();
      if (!qjson.ok) throw new Error(qjson.error?.message ?? "Quote failed");
      const fresh = qjson.data as Quote;
      const amount = BigInt(fresh.usdc6);

      const usdcMint = new PublicKey(USDC_MINT);
      const fromAta = getAssociatedTokenAddressSync(usdcMint, publicKey);
      const payoutOwner = new PublicKey(fresh.payoutAddress);
      const toAta = getAssociatedTokenAddressSync(usdcMint, payoutOwner, false, TOKEN_PROGRAM_ID);
      const toAtaInfo = await connection.getAccountInfo(toAta);
      const tx = new Transaction();
      if (source === "borrow") {
        if (!borrowAsset) throw new Error("No collateral to borrow against");
        const ix = await program.methods
          .borrow(new BN(amount.toString()))
          .accounts({
            owner: publicKey,
            config: configPda(),
            market: borrowAsset.marketKey,
            position: positionPda(borrowAsset.marketKey, publicKey),
            collateralMint: borrowAsset.mint,
            usdcVault: usdcVaultPda(),
            usdcMint,
            destinationUsdc: fromAta,
            collateralVault: collateralVaultPda(borrowAsset.marketKey),
            usdcTokenProgram: TOKEN_PROGRAM_ID,
          })
          .instruction();
        tx.add(ix);
      }
      if (!toAtaInfo) {
        tx.add(createAssociatedTokenAccountInstruction(publicKey, toAta, payoutOwner, usdcMint, TOKEN_PROGRAM_ID));
      }
      tx.add(createTransferCheckedInstruction(fromAta, usdcMint, toAta, publicKey, amount, 6));

      const sig = await sendTransaction(tx, connection);
      await connection.confirmTransaction(sig, "confirmed");
      const pres = await fetch("/api/payouts", {
        method: "POST",
        headers: await walletAuth("/api/payouts"),
        body: JSON.stringify({ quoteId: fresh.quoteId, transferSig: sig, purpose: purpose ?? undefined, source }),
      });
      const pjson = await pres.json();
      if (!pjson.ok) throw new Error(pjson.error?.message ?? "Payout failed");
      setDone(pjson.data as Payout);
      await queryClient.invalidateQueries({ queryKey: ["portfolio"] });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const code = msg.match(/Error Code: (\w+)/)?.[1];
      toast(
        code === "ExceedsMaxLtv"
          ? "That's more than your credit line. Lower the amount."
          : msg.includes("User rejected")
            ? "Signature cancelled."
            : msg,
        { variant: "error" },
      );
    } finally {
      setBusy(false);
    }
  }

  if (!publicKey) return null;

  if (done) {
    const steps = [
      { label: "Sent on Solana", done: true, bad: false },
      { label: "Processing", done: done.status !== "processing", bad: false },
      {
        label:
          done.status === "arrived"
            ? "Arrived"
            : done.status === "processing"
              ? "Arriving"
              : done.status === "failed"
                ? "Failed"
                : "Returned",
        done: done.status === "arrived",
        bad: done.status === "failed" || done.status === "returned",
      },
    ];
    return (
      <Sheet title="Send to your bank" wide onClose={() => router.push("/")}>
        <ol className="space-y-3">
          {steps.map((s, i) => (
            <li key={i} className="flex items-center gap-3">
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${s.bad ? "bg-bad text-white" : s.done ? "bg-brass text-on-brass" : "border border-rule text-ink-3"}`}
              >
                {s.bad ? "✕" : s.done ? "✓" : i + 1}
              </span>
              <span className={s.bad ? "font-semibold text-bad" : s.done ? "font-semibold" : "text-ink-3"}>{s.label}</span>
              {i === 0 ? (
                <a
                  className="text-sm text-brass"
                  target="_blank"
                  rel="noreferrer"
                  href={`https://explorer.solana.com/tx/${done.transferSig}?cluster=devnet`}
                >
                  ↗
                </a>
              ) : null}
            </li>
          ))}
        </ol>
        <p className="mt-4 font-mono text-sm tabular text-ink-2">
          −{eur(done.eurCents)} → ··{done.bankLast4} · SEPA ref {done.sepaReference}
        </p>
        <p className="mt-1 text-xs text-ink-3">Simulated SEPA payout on devnet — no real money moves.</p>
        <button
          onClick={() => router.push("/")}
          className="mt-5 flex min-h-[52px] w-full items-center justify-center rounded-xl bg-brass px-4 font-semibold text-on-brass"
        >
          Done
        </button>
      </Sheet>
    );
  }

  const needsPurpose = eurCents > PURPOSE_REQUIRED_ABOVE_CENTS;
  const canConfirm =
    !busy && !!account && !!quote && eurCents >= 1000 && !preview?.overMax && (!needsPurpose || !!purpose);

  return (
    <Sheet title="Send to your bank" wide>
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-surface p-1" role="tablist" aria-label="Source">
        {(
          [
            ["borrow", "Borrow"],
            ["balance", "Card balance"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={source === id}
            onClick={() => setSource(id)}
            className={`min-h-[44px] rounded-lg text-sm font-semibold ${source === id ? "bg-raised shadow-sm" : "text-ink-2"}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        <AmountInput
          label="Amount"
          prefix="€"
          value={amountStr}
          onChange={setAmountStr}
          hint={quote ? `≈ ${formatUsd(BigInt(quote.usdc6))} USDC` : eurCents > 0 && eurCents < 1000 ? "Minimum €10.00" : undefined}
        />
      </div>

      <div className="mt-4 flex items-center justify-between rounded-xl border border-rule bg-raised px-4 py-3">
        <span className="text-sm text-ink-2">To</span>
        {accounts.length > 0 && account ? (
          <select
            aria-label="Bank account"
            value={account.id}
            onChange={(e) => setAccountId(e.target.value)}
            className="min-h-[44px] max-w-[55%] bg-transparent font-mono text-sm"
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.country} ··{a.last4} · {a.holderName}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-sm text-ink-3">No account yet</span>
        )}
        <button onClick={() => setAddOpen(true)} className="min-h-[44px] text-sm font-semibold text-brass">
          + Add
        </button>
      </div>

      {quote ? (
        <div className="mt-4 rounded-xl bg-raised p-4">
          <PreviewRow label="Rate" value={`1 USD = ${quote.rate.toFixed(4)} EUR · ECB`} />
          <PreviewRow label="StockCard fee" value={eur(quote.stockcardFeeCents)} />
          <PreviewRow label="Provider fee" value={eur(quote.providerFeeCents)} />
          <PreviewRow label="You receive" value={eur(quote.receiveCents)} />
          <PreviewRow label="Arrives" value={quote.rail === "sepa_instant" ? "SEPA Instant · seconds" : "SEPA · 1 business day"} />
          {preview ? (
            <>
              <PreviewRow
                label="New LTV"
                value={`${formatPct(borrowAsset!.ltv)} → ${formatPct(preview.ltv)}`}
                tone={preview.overMax ? "bad" : undefined}
              />
              <PreviewRow label="APR" value={formatPct(BigInt(preview.apr))} />
              <PreviewRow
                label={`Liquidation if ${borrowAsset!.info.symbol.replace(/x$/, "")} <`}
                value={formatUsd(preview.liqPx)}
              />
            </>
          ) : null}
        </div>
      ) : eurCents >= 1000 && account ? (
        <div className="mt-4 h-32 animate-pulse rounded-xl bg-raised" />
      ) : null}

      {preview?.overMax ? (
        <p className="mt-3 text-sm text-bad">That&apos;s more than your credit line. Lower the amount.</p>
      ) : null}

      {needsPurpose ? (
        <div className="mt-4">
          <p className="text-sm text-ink-2">What&apos;s this for?</p>
          <div className="mt-2 flex gap-2">
            {PURPOSES.map((p) => (
              <button
                key={p}
                aria-pressed={purpose === p}
                onClick={() => setPurpose(p)}
                className={`min-h-[44px] rounded-full px-4 text-sm ${purpose === p ? "bg-brass-soft font-semibold text-brass" : "text-ink-2"}`}
              >
                {p}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-ink-3">
            Large transfers may require extra checks by your bank and our payout partner.
          </p>
        </div>
      ) : null}

      <button
        onClick={confirm}
        disabled={!canConfirm}
        className="mt-5 flex min-h-[52px] w-full items-center justify-center rounded-xl bg-brass px-4 font-semibold text-on-brass disabled:opacity-40"
      >
        {busy ? "Signing…" : "Confirm and sign"}
      </button>
      <p className="mt-3 text-xs text-ink-3">
        Not tax advice. Borrowing costs interest and your collateral can be liquidated.
      </p>

      {addOpen ? (
        <AddAccountSheet
          defaultName=""
          onClose={() => setAddOpen(false)}
          onSaved={(a) => {
            setAddOpen(false);
            setAccountId(a.id);
            void accountsQuery.refetch();
          }}
        />
      ) : null}
    </Sheet>
  );
}

function AddAccountSheet({
  defaultName,
  onClose,
  onSaved,
}: {
  defaultName: string;
  onClose: () => void;
  onSaved: (a: BankAccount) => void;
}) {
  const walletAuth = useWalletAuth();
  const { toast } = useToast();
  const [holderName, setHolderName] = useState(defaultName);
  const [iban, setIban] = useState("");
  const [bic, setBic] = useState("");
  const [busy, setBusy] = useState(false);

  const check = iban.trim() ? validateIban(iban) : null;

  async function save() {
    setBusy(true);
    try {
      const res = await fetch("/api/bank-accounts", {
        method: "POST",
        headers: await walletAuth("/api/bank-accounts"),
        body: JSON.stringify({ holderName, iban: normalizeIban(iban), bic: bic || undefined }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error?.message ?? "Could not save");
      toast("Bank account saved");
      onSaved(json.data as BankAccount);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not save", { variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet title="Add bank account" onClose={onClose}>
      <label className="block text-sm text-ink-2">
        Account holder
        <input
          value={holderName}
          onChange={(e) => setHolderName(e.target.value)}
          placeholder="Must match your name"
          className="mt-1 min-h-[48px] w-full rounded-xl border border-rule bg-raised px-4 outline-none focus:border-brass"
        />
      </label>
      <label className="mt-3 block text-sm text-ink-2">
        IBAN
        <input
          value={iban}
          onChange={(e) => setIban(formatIban(e.target.value))}
          placeholder="DE44 5001 0517 5407 3249 31"
          autoComplete="off"
          className="mt-1 min-h-[48px] w-full rounded-xl border border-rule bg-raised px-4 font-mono outline-none focus:border-brass"
        />
      </label>
      {check ? (
        <p className={`mt-1 text-xs ${check.ok ? "text-good" : "text-bad"}`}>
          {check.ok ? "IBAN looks valid ✓" : (check.message ?? "Check the IBAN.")}
        </p>
      ) : null}
      <label className="mt-3 block text-sm text-ink-2">
        BIC <span className="text-ink-3">(optional)</span>
        <input
          value={bic}
          onChange={(e) => setBic(e.target.value.toUpperCase())}
          className="mt-1 min-h-[48px] w-full rounded-xl border border-rule bg-raised px-4 font-mono outline-none focus:border-brass"
        />
      </label>
      <button
        onClick={save}
        disabled={busy || !holderName.trim() || !check?.ok}
        className="mt-5 flex min-h-[52px] w-full items-center justify-center rounded-xl bg-brass px-4 font-semibold text-on-brass disabled:opacity-40"
      >
        {busy ? "Saving…" : "Save account"}
      </button>
    </Sheet>
  );
}
