"use client";

import { useRef } from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useReducedMotion,
} from "motion/react";
import type { TierId } from "@/data/tiers";

const FINISHES: Record<TierId | "default", { background: string; text: string; sub: string }> = {
  black: {
    background: "var(--metal-black)",
    text: "#F3F5F7",
    sub: "#9AA4B2",
  },
  plus: {
    background: "var(--metal-silver)",
    text: "#16181B",
    sub: "#4A5158",
  },
  standard: {
    background: "linear-gradient(135deg,#1A2027,#0F1318 60%,#161B22)",
    text: "#F3F5F7",
    sub: "#9AA4B2",
  },
  default: {
    background: "var(--metal-black)",
    text: "#F3F5F7",
    sub: "#9AA4B2",
  },
};

export function StockCardVisual({
  tier = "default",
  tilt = true,
  className = "",
}: {
  tier?: TierId | "default";
  tilt?: boolean;
  className?: string;
}) {
  const finish = FINISHES[tier];
  const ref = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  const mx = useMotionValue(0.5);
  const my = useMotionValue(0.5);
  const sx = useSpring(mx, { stiffness: 180, damping: 24 });
  const sy = useSpring(my, { stiffness: 180, damping: 24 });
  const rotateX = useTransform(sy, [0, 1], [8, -8]);
  const rotateY = useTransform(sx, [0, 1], [-10, 10]);
  const sweepX = useTransform(sx, [0, 1], ["-30%", "130%"]);

  const interactive = tilt && !reduceMotion;

  function onPointerMove(e: React.PointerEvent) {
    if (!interactive || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    mx.set((e.clientX - rect.left) / rect.width);
    my.set((e.clientY - rect.top) / rect.height);
  }

  function onPointerLeave() {
    mx.set(0.5);
    my.set(0.5);
  }

  return (
    <div
      ref={ref}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      className={`[perspective:1200px] ${className}`}
      aria-label="StockCard metal card render"
      role="img"
    >
      <motion.div
        style={interactive ? { rotateX, rotateY, transformStyle: "preserve-3d" } : undefined}
        className="relative aspect-[8/5] w-full overflow-hidden rounded-2xl border border-line shadow-[0_40px_80px_-20px_rgba(0,0,0,0.7)]"
      >
        {/* metal finish */}
        <div className="absolute inset-0" style={{ background: finish.background }} />
        {/* brushed texture */}
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            background:
              "repeating-linear-gradient(115deg, transparent 0 2px, #fff 2px 3px)",
          }}
        />
        {/* light sweep following the pointer */}
        {interactive && (
          <motion.div
            aria-hidden
            className="absolute inset-y-[-40%] w-1/3 -skew-x-12"
            style={{
              left: 0,
              x: sweepX,
              background:
                "linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent)",
            }}
          />
        )}

        <div className="relative flex h-full flex-col justify-between p-6" style={{ color: finish.text }}>
          <div className="flex items-start justify-between">
            <span className="font-display text-lg font-semibold tracking-tight">StockCard</span>
            {/* contactless mark */}
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
              {[4, 8, 12].map((r) => (
                <path
                  key={r}
                  d={`M${12 - r} ${12 + r * 0.7} A ${r * 1.4} ${r * 1.4} 0 0 1 ${12 - r} ${12 - r * 0.7}`}
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  opacity={0.45 + r / 24}
                />
              ))}
            </svg>
          </div>

          {/* chip */}
          <div
            className="h-9 w-12 rounded-md border"
            style={{
              borderColor: "rgba(0,0,0,0.25)",
              background:
                tier === "plus"
                  ? "linear-gradient(135deg,#C9CDD3,#9AA0A8)"
                  : "linear-gradient(135deg,#3A3E44,#22252A)",
            }}
          >
            <div className="mx-1 mt-[7px] space-y-[5px]">
              <div className="h-px bg-black/25" />
              <div className="h-px bg-black/25" />
              <div className="h-px bg-black/25" />
            </div>
          </div>

          <div className="flex items-end justify-between">
            <div>
              <p className="font-numbers text-[11px] tracking-[0.25em]" style={{ color: finish.sub }}>
                •••• •••• •••• ••••
              </p>
              <p className="mt-1 text-[10px] tracking-widest uppercase" style={{ color: finish.sub }}>
                In development · Devnet beta
              </p>
            </div>
            {/* Network shown as text placeholder only — no card-network logos until an issuer approves */}
            <span className="font-display text-sm font-semibold tracking-[0.2em]" style={{ color: finish.sub }}>
              VISA
            </span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
