"use client";

import { useEffect, useRef, useState } from "react";
import { track } from "@vercel/analytics";
import {
  preview,
  maxLtv,
  liquidationThreshold,
  SUGGESTED_MAX_LTV,
  type AssetType,
} from "@/lib/credit";

const ASSET_LABELS: Record<AssetType, string> = {
  stocks: "Stocks",
  cards: "Graded card",
  watches: "Watch",
  art: "Art note",
};

const PRESETS: { label: string; type: AssetType; value: number }[] = [
  { label: "$10,000 stock", type: "stocks", value: 10_000 },
  { label: "$50,000 graded card", type: "cards", value: 50_000 },
  { label: "$50,000 watch", type: "watches", value: 50_000 },
  { label: "$50,000 art note", type: "art", value: 50_000 },
];

const money = (n: number) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const money0 = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

export function Calculator() {
  const [type, setType] = useState<AssetType>("stocks");
  const [value, setValue] = useState(10_000);
  const [borrowed, setBorrowed] = useState(3_500);
  const sectionRef = useRef<HTMLElement>(null);
  const fired = useRef(false);

  function fireView() {
    if (!fired.current) {
      fired.current = true;
      track("calculator_view");
    }
  }

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => entries.some((e) => e.isIntersecting) && fireView(),
      { threshold: 0.4 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const line = maxLtv(type) * value;
  const clampedBorrowed = Math.min(borrowed, Math.floor(line));
  const p = preview(type, value, clampedBorrowed);
  const liq = liquidationThreshold(type);

  // Health: mint at low LTV, warn once LTV passes 50%, danger near the liquidation threshold.
  const healthColor =
    p.ltv >= liq * 0.85 ? "bg-danger" : p.ltv >= 0.5 ? "bg-warn" : "bg-accent-2";
  const healthPct = Math.min(100, (p.ltv / liq) * 100);

  return (
    <section
      id="calculator"
      ref={sectionRef}
      aria-labelledby="calculator-heading"
      className="border-y border-line bg-surface py-24"
    >
      <div className="mx-auto max-w-6xl px-6">
        <p className="font-numbers text-xs tracking-[0.3em] text-accent-2 uppercase">Credit, made legible</p>
        <h2 id="calculator-heading" className="font-display mt-4 max-w-2xl text-3xl font-semibold tracking-tight sm:text-5xl">
          See exactly what you can borrow.
        </h2>
        <p className="mt-4 max-w-xl text-text-2">
          Lower LTV, lower rate. The safety rules are enforced by the on-chain program — the same
          math runs here.
        </p>

        <div className="mt-12 grid gap-8 lg:grid-cols-2">
          {/* inputs */}
          <div className="rounded-2xl border border-line bg-ground p-6 sm:p-8">
            <div className="flex flex-wrap gap-2" role="group" aria-label="Asset type">
              {(Object.keys(ASSET_LABELS) as AssetType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setType(t);
                    fireView();
                  }}
                  aria-pressed={type === t}
                  className={`min-h-11 rounded-lg border px-4 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-accent focus:outline-none ${
                    type === t
                      ? "border-accent bg-accent/15 text-text"
                      : "border-line bg-surface-2 text-text-2 hover:border-text-2"
                  }`}
                >
                  {ASSET_LABELS[t]}
                </button>
              ))}
            </div>

            <div className="mt-6 flex flex-wrap gap-2" role="group" aria-label="Example values">
              {PRESETS.map((pr) => (
                <button
                  key={pr.label}
                  type="button"
                  onClick={() => {
                    setType(pr.type);
                    setValue(pr.value);
                    setBorrowed(Math.floor(pr.value * maxLtv(pr.type) * 0.7));
                    fireView();
                  }}
                  className="min-h-11 rounded-lg border border-line px-3 py-1.5 text-xs text-text-2 transition-colors hover:border-accent hover:text-text focus-visible:ring-2 focus-visible:ring-accent focus:outline-none"
                >
                  {pr.label}
                </button>
              ))}
            </div>

            <label className="mt-8 block">
              <span className="text-sm text-text-2">Asset value</span>
              <span className="mt-1 flex items-center gap-2 rounded-lg border border-line bg-surface-2 px-4 focus-within:border-accent">
                <span className="text-text-2">$</span>
                <input
                  type="number"
                  min={0}
                  value={value || ""}
                  onChange={(e) => {
                    const v = Math.max(0, Number(e.target.value) || 0);
                    setValue(v);
                    setBorrowed((b) => Math.min(b, Math.floor(maxLtv(type) * v)));
                    fireView();
                  }}
                  className="min-h-11 w-full bg-transparent py-3 font-numbers text-text focus:outline-none"
                  aria-label="Asset value in dollars"
                />
              </span>
            </label>

            <label className="mt-8 block">
              <span className="flex items-baseline justify-between text-sm text-text-2">
                <span>Borrow</span>
                <span className="font-numbers text-text">{money0(clampedBorrowed)}</span>
              </span>
              <input
                type="range"
                min={0}
                max={Math.max(1, Math.floor(line))}
                step={Math.max(1, Math.floor(line / 200))}
                value={clampedBorrowed}
                onChange={(e) => {
                  setBorrowed(Number(e.target.value));
                  fireView();
                }}
                aria-label={`Borrow amount, up to ${money0(line)}`}
                aria-valuetext={`${money0(clampedBorrowed)} of ${money0(line)} credit line`}
                className="mt-3 h-2 w-full cursor-pointer accent-accent"
              />
              <span className="mt-1 flex justify-between text-xs text-text-2">
                <span>$0</span>
                <span>max LTV {Math.round(maxLtv(type) * 100)}% → {money0(line)}</span>
              </span>
            </label>
          </div>

          {/* outputs */}
          <div className="rounded-2xl border border-line bg-surface-2 p-6 sm:p-8">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-xs text-text-2">Credit line</p>
                <p className="font-numbers mt-1 text-2xl text-text">{money0(p.creditLine)}</p>
              </div>
              <div>
                <p className="text-xs text-text-2">APR at this LTV</p>
                <p className="font-numbers mt-1 text-2xl text-text">{(p.apr * 100).toFixed(1)}%</p>
              </div>
              <div>
                <p className="text-xs text-text-2">Daily interest</p>
                <p className="font-numbers mt-1 text-2xl text-text">{money(p.dailyInterest)}/day</p>
              </div>
              <div>
                <p className="text-xs text-text-2">Liquidation below</p>
                <p className="font-numbers mt-1 text-2xl text-text">{money0(p.liquidationValue)}</p>
              </div>
            </div>

            <div className="mt-8">
              <div className="flex items-baseline justify-between text-xs text-text-2">
                <span>Health</span>
                <span className="font-numbers">LTV {(p.ltv * 100).toFixed(0)}%</span>
              </div>
              <div
                className="relative mt-2 h-2 overflow-hidden rounded-full bg-ground"
                role="meter"
                aria-valuenow={Math.round(p.ltv * 100)}
                aria-valuemin={0}
                aria-valuemax={Math.round(liq * 100)}
                aria-label={`LTV ${(p.ltv * 100).toFixed(0)} percent, liquidation at ${Math.round(liq * 100)} percent`}
              >
                <div className={`h-full rounded-full transition-all ${healthColor}`} style={{ width: `${healthPct}%` }} />
                {/* max-LTV and liquidation markers */}
                <div className="absolute inset-y-0 w-px bg-text-2/60" style={{ left: `${(maxLtv(type) / liq) * 100}%` }} />
                <div className="absolute inset-y-0 right-0 w-px bg-danger/70" />
              </div>
              <div className="mt-1 flex justify-between text-[11px] text-text-2">
                <span>suggested max {Math.round(SUGGESTED_MAX_LTV * 100)}%</span>
                <span>liquidation {Math.round(liq * 100)}%</span>
              </div>
            </div>

            <p className="mt-8 rounded-xl border border-line bg-ground p-4 text-sm leading-relaxed">
              At <span className="font-numbers text-accent-2">{money0(clampedBorrowed)}</span> borrowed
              against <span className="font-numbers">{money0(value)}</span> of {ASSET_LABELS[type].toLowerCase()},
              the price can fall{" "}
              <span className="font-numbers text-accent-2">{(p.canFallPct * 100).toFixed(0)}%</span>{" "}
              before liquidation.
            </p>
          </div>
        </div>

        <p className="mt-6 text-xs text-text-2">
          In development · Devnet beta · Not available yet. Borrowing against assets carries the risk of liquidation.
        </p>
      </div>
    </section>
  );
}
