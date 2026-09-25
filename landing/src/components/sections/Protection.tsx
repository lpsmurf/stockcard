import { Reveal } from "@/components/Reveal";

const ITEMS = [
  {
    title: "A buffer before anything happens",
    body: "Your borrowing limit sits well below the liquidation threshold. There's room for prices to move before you're at risk.",
  },
  {
    title: "Alerts before liquidation",
    body: "In-app and web push alerts warn you as your position weakens, so you can add collateral or repay in time. Liquidation is a last resort, never a surprise.",
  },
  {
    title: "Your collateral stays on-chain",
    body: "Assets sit in an on-chain Solana program, not with us. The safety rules are code — StockCard can't move your collateral.",
  },
];

export function Protection() {
  return (
    <section aria-labelledby="protection-heading" className="border-y border-line bg-surface py-24">
      <div className="mx-auto max-w-6xl px-6">
        <Reveal>
          <h2 id="protection-heading" className="font-display max-w-2xl text-3xl font-semibold tracking-tight sm:text-5xl">
            Built so you sleep at night.
          </h2>
        </Reveal>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {ITEMS.map((item, i) => (
            <Reveal key={item.title} delay={i * 0.08}>
              <div className="h-full rounded-2xl border border-line bg-ground p-7">
                <div className="h-1 w-10 rounded-full bg-accent-2" aria-hidden />
                <h3 className="font-display mt-5 text-xl font-semibold">{item.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-text-2">{item.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
