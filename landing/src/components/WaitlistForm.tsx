"use client";

import { Suspense, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { track } from "@vercel/analytics";
import {
  ASSET_TO_LOCK_OPTIONS,
  CASHBACK_ASSET_OPTIONS,
  REFERRAL_REWARD,
  REFERRAL_SPOTS_PER_FRIEND,
} from "@/lib/waitlist";

type Success = {
  position: number;
  referralCode: string;
  referralUrl: string;
  alreadyJoined: boolean;
};

function WaitlistFormInner({ id }: { id: string }) {
  const params = useSearchParams();
  const ref = params.get("ref") ?? undefined;

  const [email, setEmail] = useState("");
  const [assetToLock, setAssetToLock] = useState<string>("Not sure");
  const [cashbackAsset, setCashbackAsset] = useState<string>("Not sure");
  const [wallet, setWallet] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState<Success | null>(null);
  const started = useRef(false);

  function onFirstFocus() {
    if (!started.current) {
      started.current = true;
      track("signup_start");
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, assetToLock, cashbackAsset, wallet: wallet || undefined, ref }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Something went wrong. Try again.");
      } else {
        setSuccess(data as Success);
        track("signup_complete");
      }
    } catch {
      setError("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (success) return <SuccessPanel {...success} />;

  const selectClass =
    "w-full rounded-lg border border-line bg-surface-2 px-4 py-3 text-sm text-text focus:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent";

  return (
    <form onSubmit={onSubmit} className="w-full space-y-3" aria-label="Join the waitlist">
      <div className="flex flex-col gap-3 sm:flex-row">
        <label htmlFor={`${id}-email`} className="sr-only">
          Email address
        </label>
        <input
          id={`${id}-email`}
          type="email"
          required
          value={email}
          onFocus={onFirstFocus}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="min-h-11 flex-1 rounded-lg border border-line bg-surface-2 px-4 py-3 text-sm text-text placeholder:text-text-2 focus:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
        <button
          type="submit"
          disabled={busy}
          className="min-h-11 rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent/85 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ground focus:outline-none disabled:opacity-60"
        >
          {busy ? "Joining…" : "Join the waitlist"}
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs text-text-2">What would you lock?</span>
          <select value={assetToLock} onChange={(e) => setAssetToLock(e.target.value)} className={selectClass}>
            {ASSET_TO_LOCK_OPTIONS.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-text-2">Cashback in</span>
          <select value={cashbackAsset} onChange={(e) => setCashbackAsset(e.target.value)} className={selectClass}>
            {CASHBACK_ASSET_OPTIONS.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </label>
      </div>

      <label className="block">
        <span className="mb-1 block text-xs text-text-2">Solana wallet (optional)</span>
        <input
          type="text"
          value={wallet}
          onChange={(e) => setWallet(e.target.value)}
          placeholder="So1ana…"
          className="min-h-11 w-full rounded-lg border border-line bg-surface-2 px-4 py-3 font-numbers text-sm text-text placeholder:text-text-2 focus:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
      </label>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {ref && <p className="text-xs text-accent-2">You were referred — your friend moves up when you join.</p>}</form>
  );
}

function SuccessPanel({ position, referralCode, referralUrl }: Success) {
  const [copied, setCopied] = useState(false);
  const shareText = "I'm on the StockCard waitlist — a credit card backed by real assets on Solana. Join with my link:";

  async function copy() {
    try {
      await navigator.clipboard.writeText(referralUrl);
      setCopied(true);
      track("referral_share", { channel: "copy" });
    } catch {
      /* clipboard unavailable */
    }
  }

  const shareClass =
    "inline-flex min-h-11 items-center justify-center rounded-lg border border-line bg-surface-2 px-4 py-2 text-sm text-text transition-colors hover:border-accent focus-visible:ring-2 focus-visible:ring-accent focus:outline-none";

  return (
    <div className="w-full rounded-xl border border-accent-2/30 bg-surface p-6 text-left">
      <p className="text-xs tracking-widest text-accent-2 uppercase">You&rsquo;re on the list</p>
      <p className="font-display mt-2 text-4xl font-semibold">
        <span className="font-numbers">#{position}</span>
        <span className="ml-2 text-base font-normal text-text-2">in the queue</span>
      </p>
      <p className="mt-4 text-sm text-text-2">
        Move up {REFERRAL_SPOTS_PER_FRIEND} spots per friend who joins. Referral reward: {REFERRAL_REWARD} —
        Plus-tier cashback for your first 3 months.
      </p>
      <p className="mt-4 break-all rounded-lg border border-line bg-surface-2 px-3 py-2 font-numbers text-xs text-accent-2">
        {referralUrl}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <a
          className={shareClass}
          href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(referralUrl)}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => track("referral_share", { channel: "x" })}
        >
          Share on X
        </a>
        <a
          className={shareClass}
          href={`https://wa.me/?text=${encodeURIComponent(`${shareText} ${referralUrl}`)}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => track("referral_share", { channel: "whatsapp" })}
        >
          WhatsApp
        </a>
        <button type="button" className={shareClass} onClick={copy}>
          {copied ? "Copied" : "Copy link"}
        </button>
      </div>
      <p className="mt-3 text-xs text-text-2">Your code: <span className="font-numbers">{referralCode}</span></p>
    </div>
  );
}

export function WaitlistForm({ id }: { id: string }) {
  return (
    <Suspense fallback={null}>
      <WaitlistFormInner id={id} />
    </Suspense>
  );
}
