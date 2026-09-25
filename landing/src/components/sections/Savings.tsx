import { Reveal } from "@/components/Reveal";
import { SAVINGS_LEGAL_NOTE } from "@/data/tiers";

export function Savings() {
  return (
    <section aria-labelledby="savings-heading" className="py-24">
      <div className="mx-auto max-w-6xl px-6">
        <Reveal>
          <div className="rounded-2xl border border-line bg-surface p-8 sm:p-12">
            <p className="font-numbers text-xs tracking-[0.3em] text-accent-2 uppercase">Savings</p>
            <h2 id="savings-heading" className="font-display mt-4 max-w-2xl text-3xl font-semibold tracking-tight sm:text-5xl">
              Earn ~6% on USDC.
            </h2>
            <p className="mt-5 max-w-2xl leading-relaxed text-text-2">
              Your savings fund the credit lines. Borrowers pay interest; 60% of it goes to savers.
              The rate is variable — it moves with real borrowing demand, not a subsidy.
            </p>
            <p className="mt-6 text-xs text-text-2">{SAVINGS_LEGAL_NOTE}</p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
