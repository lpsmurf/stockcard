import { Reveal } from "@/components/Reveal";

export function Cashback() {
  return (
    <section aria-labelledby="cashback-heading" className="py-24">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 lg:grid-cols-2">
        <Reveal>
          <p className="font-numbers text-xs tracking-[0.3em] text-accent-2 uppercase">Cashback</p>
          <h2 id="cashback-heading" className="font-display mt-4 text-3xl font-semibold tracking-tight text-balance sm:text-5xl">
            Every purchase buys you more of what you own.
          </h2>
          <p className="mt-5 max-w-md leading-relaxed text-text-2">
            Cashback is paid in the real asset you pick — and lands straight in your collateral
            position, so spending grows the thing you never wanted to sell.
          </p>
          <p className="mt-4 max-w-md text-sm text-text-2">
            Highest cashback on spend up to a quarter of the credit you use.
          </p>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="rounded-2xl border border-line bg-surface p-7">
            <p className="text-xs tracking-widest text-text-2 uppercase">Example · Plus tier</p>
            <div className="mt-5 space-y-4">
              <div className="flex items-baseline justify-between border-b border-line pb-4">
                <span className="text-sm text-text-2">Groceries</span>
                <span className="font-numbers text-xl">€62.15</span>
              </div>
              <div className="flex items-baseline justify-between border-b border-line pb-4">
                <span className="text-sm text-text-2">Cashback at 1.5%</span>
                <span className="font-numbers text-xl text-accent-2">€0.93</span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-text-2">Buys NVDAx at $211.96</span>
                <span className="font-numbers text-xl text-accent-2">+0.0044 NVDAx</span>
              </div>
            </div>
            <p className="mt-6 text-xs text-text-2">In development · Devnet beta · Not available yet</p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
