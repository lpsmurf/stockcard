import Image from "next/image";
import { RWA_EXAMPLES, RWA_CAPTION } from "@/data/rwa-examples";
import { Reveal } from "@/components/Reveal";

function valueChip(v: number) {
  return `$${v.toLocaleString("en-US")}`;
}

export function AssetStrip() {
  // Duplicate the list so the marquee can loop seamlessly.
  const items = [...RWA_EXAMPLES, ...RWA_EXAMPLES];
  return (
    <section aria-labelledby="assets-heading" className="border-y border-line bg-surface py-20">
      <div className="mx-auto max-w-6xl px-6">
        <Reveal>
          <p className="font-numbers text-xs tracking-[0.3em] text-accent-2 uppercase">What you can lock</p>
          <h2 id="assets-heading" className="font-display mt-4 max-w-2xl text-3xl font-semibold tracking-tight sm:text-5xl">
            Real items, already tokenized on Solana.
          </h2>
          <p className="mt-4 max-w-xl text-text-2">
            Tokenized stocks, graded cards — including cards pulled from Solflare Packs — luxury
            watches and art notes.
          </p>
        </Reveal>
      </div>

      <Reveal className="mt-12 overflow-hidden" delay={0.1}>
        <div className="group relative">
          <div className="flex w-max animate-[marquee_60s_linear_infinite] gap-5 pr-5 group-hover:[animation-play-state:paused] motion-reduce:animate-none">
            {items.map((item, i) => (
              <figure
                key={`${item.mint}-${i}`}
                className="w-52 shrink-0 overflow-hidden rounded-xl border border-line bg-surface-2"
              >
                <div className="relative aspect-[4/3] bg-ground">
                  <Image
                    src={item.image}
                    alt={`${item.name}${item.grade ? `, graded ${item.grade}` : ""}`}
                    fill
                    sizes="208px"
                    className="object-cover"
                  />
                </div>
                <figcaption className="p-3">
                  <p className="truncate text-sm font-medium text-text">{item.name}</p>
                  <p className="mt-1 flex items-center justify-between text-xs text-text-2">
                    <span>{item.grade ?? item.category}</span>
                    <span className="font-numbers rounded border border-line px-1.5 py-0.5 text-accent-2">
                      {valueChip(item.insuredValueUsd)}
                    </span>
                  </p>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
        <p className="mx-auto mt-6 max-w-6xl px-6 text-xs text-text-2">{RWA_CAPTION}</p>
      </Reveal>
    </section>
  );
}
