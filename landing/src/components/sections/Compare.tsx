import { COMPARE_COLUMNS, COMPARE_ROWS, COMPARE_FOOTNOTE } from "@/data/tiers";
import { Reveal } from "@/components/Reveal";

export function Compare() {
  return (
    <section aria-labelledby="compare-heading" className="border-y border-line bg-surface py-24">
      <div className="mx-auto max-w-6xl px-6">
        <Reveal>
          <h2 id="compare-heading" className="font-display max-w-2xl text-3xl font-semibold tracking-tight sm:text-5xl">
            How we compare.
          </h2>
        </Reveal>
        <Reveal className="mt-10" delay={0.05}>
          <div className="overflow-x-auto rounded-2xl border border-line">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead>
                <tr className="bg-surface-2">
                  <th scope="col" className="sticky left-0 bg-surface-2 p-4 text-left font-medium text-text-2" />
                  {COMPARE_COLUMNS.map((c, i) => (
                    <th
                      key={c}
                      scope="col"
                      className={`p-4 text-left font-semibold ${i === 0 ? "text-accent-2" : "text-text"}`}
                    >
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARE_ROWS.map((row) => (
                  <tr key={row.label} className="border-t border-line">
                    <th scope="row" className="sticky left-0 bg-ground p-4 text-left font-medium text-text-2">
                      {row.label}
                    </th>
                    {row.values.map((v, i) => (
                      <td key={i} className={`p-4 align-top ${i === 0 ? "text-text" : "text-text-2"}`}>
                        {v}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-xs text-text-2">{COMPARE_FOOTNOTE}</p>
        </Reveal>
      </div>
    </section>
  );
}
