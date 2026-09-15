import type { ReactNode } from "react";

/** Alert banner: warn (amber) or bad (red) variants with optional actions. */
export function Banner({
  variant,
  title,
  children,
  actions,
}: {
  variant: "warn" | "bad";
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  const styles = variant === "bad" ? "border-bad/40 bg-bad/10 text-bad" : "border-warn/40 bg-warn/10 text-warn";
  return (
    <div role="alert" className={`rounded-xl border p-4 ${styles}`}>
      <p className="text-sm font-semibold">{title}</p>
      {children ? <div className="mt-1 text-sm opacity-90">{children}</div> : null}
      {actions ? <div className="mt-3 flex gap-2">{actions}</div> : null}
    </div>
  );
}
