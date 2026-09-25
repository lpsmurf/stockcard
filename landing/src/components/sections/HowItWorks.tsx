import { Reveal } from "@/components/Reveal";

const STEPS = [
  {
    n: "01",
    title: "Lock",
    body: "Deposit tokenized stocks, a graded card, a watch or an art note into the on-chain vault. You keep ownership — the program holds it, not us.",
  },
  {
    n: "02",
    title: "Borrow",
    body: "Get a USDC credit line against what you locked. Borrow less, pay less — rates start at 9.9% APR.",
  },
  {
    n: "03",
    title: "Spend",
    body: "Pay anywhere with your StockCard. Cashback from every purchase buys more of the asset you chose.",
  },
  {
    n: "04",
    title: "Repay anytime, take it back",
    body: "No fixed schedule, no lock-ups. Repay and your collateral is yours again, immediately.",
  },
];

export function HowItWorks() {
  return (
    <section aria-labelledby="how-heading" className="py-24">
      <div className="mx-auto max-w-6xl px-6">
        <Reveal>
          <h2 id="how-heading" className="font-display max-w-2xl text-3xl font-semibold tracking-tight sm:text-5xl">
            Lock. Borrow. Spend.
          </h2>
        </Reveal>
        <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <Reveal key={s.n} delay={i * 0.08} className="bg-surface p-7">
              <p className="font-numbers text-xs tracking-[0.3em] text-accent-2">{s.n}</p>
              <h3 className="font-display mt-4 text-xl font-semibold">{s.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-text-2">{s.body}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
