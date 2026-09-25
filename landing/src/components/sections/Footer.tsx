import { WaitlistForm } from "@/components/WaitlistForm";
import { Reveal } from "@/components/Reveal";
import { OPEN_RWA_IMAGES } from "@/data/rwa-examples";

const DISCLAIMER =
  "StockCard is in development. Nothing on this site is an offer of credit, securities or a payment card. Borrowing against assets carries the risk of liquidation.";

export function Footer() {
  const credited = OPEN_RWA_IMAGES.filter((i) => i.credit);
  return (
    <footer className="border-t border-line">
      {/* Final CTA */}
      <section aria-labelledby="final-cta-heading" className="py-24">
        <div className="mx-auto max-w-2xl px-6 text-center">
          <Reveal>
            <h2 id="final-cta-heading" className="font-display text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
              Own it. Spend it. Keep it.
            </h2>
            <p className="mt-5 text-text-2">
              Join the waitlist and tell us what you&rsquo;d lock first.
            </p>
            <div className="mt-8 text-left">
              <WaitlistForm id="footer" />
            </div>
          </Reveal>
        </div>
      </section>

      <div className="border-t border-line py-10">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="font-display text-lg font-semibold">StockCard</p>
            <nav aria-label="Social" className="flex gap-5 text-sm text-text-2">
              {/* Placeholders until official profiles exist */}
              <span>X</span>
              <span>Discord</span>
              <span>GitHub</span>
            </nav>
          </div>

          <div className="text-xs leading-relaxed text-text-2">
            <p className="font-semibold text-text">Image credits</p>
            <ul className="mt-2 space-y-1">
              {credited.map((i) => (
                <li key={i.name}>
                  {i.name}:{" "}
                  <a
                    href={i.sourcePage}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-2 hover:text-text focus-visible:ring-2 focus-visible:ring-accent focus:outline-none"
                  >
                    {i.credit}
                  </a>
                </li>
              ))}
              <li>
                Rolex Submariner 16613 and T206 Ty Cobb images are public domain (Wikimedia Commons).
              </li>
              <li>
                Background plates: Pieter Claesz, <i>Still Life with a Skull and a Writing Quill</i>{" "}
                (1628) and Willem Claesz Heda, <i>Still Life with Oysters, a Silver Tazza, and
                Glassware</i> (1635) — The Met, Open Access CC0.
              </li>
              <li>
                Tokenized-item photos: Collector Crypt marketplace API. Card artwork © The Pokémon
                Company / Nintendo / Toei. Watch and trading-card brand names are trademarks of
                their owners. Not affiliated with StockCard.
              </li>
            </ul>
          </div>

          <p className="text-xs leading-relaxed text-text-2">{DISCLAIMER}</p>
          <p className="text-xs text-text-2">In development · Devnet beta · Not available yet</p>
        </div>
      </div>
    </footer>
  );
}
