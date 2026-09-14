/**
 * StockCard virtual card. Layout and last-4 masking approach adapted from crd-ui
 * (https://github.com/JuandaGarcia/crd-ui, MIT License). Network marks are text
 * placeholders until an issuer program approves brand use.
 */
type Network = "VISA" | "MASTERCARD";

export interface CreditCardProps {
  holderName: string;
  last4: string;
  expMonth: number;
  expYear: number;
  network: Network;
  availableLabel: string;
  frozen?: boolean;
}

export function CreditCard({ holderName, last4, expMonth, expYear, network, availableLabel, frozen }: CreditCardProps) {
  const exp = `${String(expMonth).padStart(2, "0")}/${String(expYear % 100).padStart(2, "0")}`;
  return (
    <div
      role="img"
      aria-label={`StockCard ${network} ending in ${last4}, ${availableLabel} available${frozen ? ", frozen" : ""}`}
      className={`relative aspect-[1.586] w-full max-w-[420px] overflow-hidden rounded-2xl p-[6%] text-[#ece5d1] shadow-[0_24px_40px_-20px_rgba(0,0,0,0.55)] ${frozen ? "grayscale" : ""}`}
      style={{ background: "linear-gradient(135deg,#2b2f2d 0%,#141715 58%,#26231c 100%)", containerType: "inline-size" }}
    >
      <div className="pointer-events-none absolute inset-0 opacity-[0.07]" style={{ background: "repeating-linear-gradient(115deg,#fff 0 1px,transparent 1px 7px)" }} />
      <div className="relative flex h-full flex-col justify-between">
        <div className="flex items-start justify-between">
          <span className="font-display text-[7cqi] leading-none">StockCard</span>
          <span className="font-mono text-[3cqi] uppercase tracking-[0.14em] text-[#bdb49e]">{frozen ? "Frozen" : "Virtual"}</span>
        </div>
        <div className="flex items-center gap-[4cqi]">
          <span className="block aspect-[1.3] w-[13cqi] rounded-[1.2cqi]" style={{ background: "linear-gradient(135deg,#dcc07e,#94763a)" }} />
          <span className="font-mono text-[5.2cqi] tracking-[0.12em] tabular">•••• •••• •••• {last4}</span>
        </div>
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <div className="font-mono text-[2.8cqi] uppercase tracking-[0.12em] text-[#a89f8a]">Available credit</div>
            <div className="font-display text-[6.4cqi] leading-tight tabular">{availableLabel}</div>
            <div className="mt-[1cqi] truncate font-mono text-[3.2cqi] uppercase tracking-[0.08em] text-[#cfc6b0]">
              {holderName} · {exp}
            </div>
          </div>
          <div className="text-right font-mono text-[3cqi] leading-tight text-[#cfc6b0]">
            <div className="text-[4.6cqi] font-medium italic tracking-[0.02em] text-[#f1ead6]">{network === "VISA" ? "VISA" : "mastercard"}</div>
            <div className="uppercase tracking-[0.1em] text-[#a89f8a]">sandbox</div>
          </div>
        </div>
      </div>
    </div>
  );
}
