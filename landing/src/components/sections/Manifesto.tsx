import { DitherArt } from "@/components/DitherArt";
import { Reveal } from "@/components/Reveal";

export function Manifesto() {
  return (
    <section aria-labelledby="manifesto-heading" className="relative overflow-hidden py-28">
      <DitherArt src="/art/vanitas-claesz.jpg" hue={150} opacity={0.25} fade="center" />
      <div className="relative mx-auto max-w-3xl px-6 text-center">
        <Reveal>
          <h2 id="manifesto-heading" className="font-display text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
            Real assets, not memecoins.
          </h2>
          <p className="mx-auto mt-8 max-w-xl text-lg leading-relaxed text-text-2">
            A credit line is only as good as what stands behind it. We back spending with things
            that hold value: company shares, graded collectibles, watches, art.
          </p>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-text-2">
            What we never accept: memecoins, governance tokens, or anything whose price exists
            because of a joke. If it can&rsquo;t be appraised, graded or audited, it isn&rsquo;t
            collateral.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
