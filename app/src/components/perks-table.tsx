import { Fragment } from "react";
import { MockBadge } from "./mock-badge";

type Tier = "standard" | "plus" | "black";

/** parameters.md "Membership perks" — planned only, none contracted. Standard gets none of these. */
const GROUPS: { group: string; perks: { name: string; plus: string | null; black: string | null }[] }[] = [
  {
    group: "Travel",
    perks: [
      { name: "Airport lounges", plus: null, black: "Unlimited passes (fair use)" },
      { name: "Fast Track security", plus: null, black: "4 per year" },
      { name: "Travel insurance", plus: null, black: "Included" },
      { name: "Global eSIM data", plus: "1 pack/year", black: "Monthly allowance" },
    ],
  },
  {
    group: "Protection",
    perks: [
      { name: "Purchase protection + extended warranty", plus: "Basic", black: "Included" },
      { name: "Trip / event cancellation", plus: null, black: "Up to 70%, max €5,000/yr" },
    ],
  },
  {
    group: "Subscriptions",
    perks: [{ name: "Pick-your subscriptions", plus: null, black: "Pick 2 of 5" }],
  },
  {
    group: "Collector",
    perks: [
      { name: "Collector perks", plus: "Early access to art drops", black: "Grading + vault credits, priority allocation" },
      { name: "Solana perks", plus: null, black: "Partner wallet benefits" },
    ],
  },
  {
    group: "Support",
    perks: [{ name: "Priority support", plus: "Yes", black: "24/7" }],
  },
];

/** T078 — "Membership perks ‹Planned›" comparison table for S9/D9. Never shows a perk as active. */
export function PerksTable({ tier }: { tier: Tier }) {
  const cols: { id: Tier; label: string }[] = [
    { id: "standard", label: "Standard" },
    { id: "plus", label: "Plus" },
    { id: "black", label: "Black" },
  ];

  return (
    <section className="mt-8" aria-label="Membership perks">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold text-ink-2">Membership perks</h2>
        <MockBadge label="Planned" />
      </div>

      <div className="mt-2 overflow-hidden rounded-xl bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-rule text-left font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">
              <th className="px-3 py-2.5 font-medium">Perk</th>
              {cols.map((c) => (
                <th
                  key={c.id}
                  className={`px-2 py-2.5 text-center font-medium ${tier === c.id ? "bg-brass-soft text-brass" : ""}`}
                  aria-current={tier === c.id ? "true" : undefined}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {GROUPS.map((g) => (
              <Fragment key={g.group}>
                <tr className="border-b border-rule bg-plaster/50">
                  <td colSpan={4} className="px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">
                    {g.group}
                  </td>
                </tr>
                {g.perks.map((p) => {
                  const cells: Record<Tier, string | null> = { standard: null, plus: p.plus, black: p.black };
                  return (
                    <tr key={p.name} className="border-b border-rule last:border-0">
                      <td className="px-3 py-2.5 text-ink">{p.name}</td>
                      {cols.map((c) => (
                        <td
                          key={c.id}
                          className={`px-2 py-2.5 text-center text-xs ${tier === c.id ? "bg-brass-soft" : ""} ${cells[c.id] ? "text-ink-2" : "text-ink-3"}`}
                        >
                          {cells[c.id] ?? "—"}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-xs text-ink-3">
        Planned benefits. Benefits depend on partner and issuer agreements and may change.
      </p>
    </section>
  );
}
