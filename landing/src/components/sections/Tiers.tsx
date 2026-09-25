"use client";

import { useState } from "react";
import {
  TIERS,
  PLANNED_PERKS_FOOTNOTE,
  TIER_SAFETY_NOTE,
  FOUNDING_OFFER,
  type TierId,
} from "@/data/tiers";
import { StockCardVisual } from "@/components/StockCardVisual";
import { Reveal } from "@/components/Reveal";

export function Tiers() {
  const [selected, setSelected] = useState<TierId>("black");
  const tier = TIERS.find((t) => t.id === selected)!;

  const core = tier.perks.filter((p) => !p.planned);
  const planned = tier.perks.filter((p) => p.planned);

  return (
    <section aria-labelledby="tiers-heading" className="border-y border-line bg-surface py-24">
      <div className="mx-auto max-w-6xl px-6">
        <Reveal>
          <p className="font-numbers text-xs tracking-[0.3em] text-accent-2 uppercase">Membership</p>
          <h2 id="tiers-heading" className="font-display mt-4 max-w-2xl text-3xl font-semibold tracking-tight sm:text-5xl">
            Pick your finish.
          </h2>
          <p className="mt-4 max-w-xl text-text-2">
            Cashback is paid in the real asset you pick. {TIER_SAFETY_NOTE}
          </p>
        </Reveal>

        <div className="mt-12 grid items-start gap-10 lg:grid-cols-[1fr_1.2fr]">
          <Reveal>
            <div className="sticky top-8">
              <div className="flex gap-2" role="tablist" aria-label="Choose tier">
                {TIERS.map((t) => (
                  <button
                    key={t.id}
                    role="tab"
                    aria-selected={selected === t.id}
                    onClick={() => setSelected(t.id)}
                    className={`min-h-11 flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-accent focus:outline-none ${
                      selected === t.id
                        ? "border-accent bg-accent/15 text-text"
                        : "border-line bg-surface-2 text-text-2 hover:border-text-2"
                    }`}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
              <div className="mt-6">
                <StockCardVisual tier={tier.id} />
              </div>
              <p className="mt-4 text-center font-display text-xl font-semibold">
                {tier.name} · <span className="text-text-2">{tier.price.monthly}{tier.price.yearly ? ` · ${tier.price.yearly}` : ""}</span>
              </p>
              <p className="mt-2 text-center text-xs text-text-2">
                In development · Devnet beta · Not available yet
              </p>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <ul className="divide-y divide-line rounded-2xl border border-line bg-ground">
              {core.map((p) => (
                <li key={p.label} className="flex gap-3 px-5 py-3.5 text-sm text-text">
                  <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-2" />
                  {p.label}
                </li>
              ))}
            </ul>

            {planned.length > 0 && (
              <>
                <h3 className="mt-8 text-sm font-semibold tracking-widest text-text-2 uppercase">
                  Planned benefits
                </h3>
                <ul className="mt-3 divide-y divide-line rounded-2xl border border-dashed border-line bg-ground">
                  {planned.map((p) => (
                    <li key={p.label} className="flex gap-3 px-5 py-3.5 text-sm text-text-2">
                      <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-warn" />
                      {p.label}
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-xs text-text-2">{PLANNED_PERKS_FOOTNOTE}</p>
              </>
            )}
          </Reveal>
        </div>

        <Reveal className="mt-16">
          <div className="rounded-2xl border border-accent-2/25 bg-surface-2 p-8">
            <p className="font-numbers text-xs tracking-[0.3em] text-accent-2 uppercase">Founding member offer</p>
            <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <h3 className="font-display text-lg font-semibold">Founding APR</h3>
                <p className="mt-2 text-sm text-text-2">
                  −{FOUNDING_OFFER.aprDiscountPts} pt for 12 months on the first €{FOUNDING_OFFER.balanceCapEur.toLocaleString("en-US")} of
                  balance — first {FOUNDING_OFFER.memberCap.toLocaleString("en-US")} waitlist members who activate
                  within {FOUNDING_OFFER.activationWindowDays} days of launch.
                </p>
              </div>
              <div>
                <h3 className="font-display text-lg font-semibold">Plus on us</h3>
                <p className="mt-2 text-sm text-text-2">{FOUNDING_OFFER.referralReward}.</p>
              </div>
              <div>
                <h3 className="font-display text-lg font-semibold">Founding saver</h3>
                <p className="mt-2 text-sm text-text-2">
                  +{FOUNDING_OFFER.saverBoostPts} pt APY on your first ${FOUNDING_OFFER.saverCapUsd.toLocaleString("en-US")} for{" "}
                  {FOUNDING_OFFER.saverMonths} months.
                </p>
              </div>
              <div>
                <h3 className="font-display text-lg font-semibold">Founders metal card</h3>
                <p className="mt-2 text-sm text-text-2">
                  Numbered design for the first {FOUNDING_OFFER.metalCardNumbered} Black members.
                </p>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
