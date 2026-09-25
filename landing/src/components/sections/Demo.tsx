import { Reveal } from "@/components/Reveal";

const DEMO_URL = process.env.NEXT_PUBLIC_DEMO_URL ?? "https://stockcard-app.vercel.app";

const STEPS = [
  "Claim test money from the faucet",
  "Buy a stock, card or watch in the Demo Shop",
  "Lock it in the vault",
  "Spend with the card",
];

export function Demo() {
  return (
    <section aria-labelledby="demo-heading" className="py-24">
      <div className="mx-auto max-w-6xl px-6">
        <Reveal>
          <div className="grid items-center gap-10 rounded-2xl border border-line bg-surface p-8 sm:p-12 lg:grid-cols-2">
            <div>
              <p className="font-numbers text-xs tracking-[0.3em] text-accent-2 uppercase">Try the demo</p>
              <h2 id="demo-heading" className="font-display mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
                It already runs on devnet.
              </h2>
              <p className="mt-4 max-w-md leading-relaxed text-text-2">
                The full loop works today with test assets: claim test money, buy in the Demo Shop,
                lock it, spend. Nothing is real — that&rsquo;s the point of a beta.
              </p>
              <a
                href={DEMO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 inline-flex min-h-11 items-center rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent/85 focus-visible:ring-2 focus-visible:ring-accent focus:outline-none"
              >
                Open the devnet app ↗
              </a>
              <p className="mt-4 text-xs text-text-2">In development · Devnet beta · Not available yet</p>
            </div>
            <ol className="space-y-3">
              {STEPS.map((s, i) => (
                <li key={s} className="flex items-center gap-4 rounded-xl border border-line bg-ground px-5 py-4">
                  <span className="font-numbers text-xs tracking-widest text-accent-2">{String(i + 1).padStart(2, "0")}</span>
                  <span className="text-sm text-text">{s}</span>
                </li>
              ))}
            </ol>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
