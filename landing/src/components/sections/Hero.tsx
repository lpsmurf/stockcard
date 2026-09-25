"use client";

import { motion, useReducedMotion } from "motion/react";
import { StockCardVisual } from "@/components/StockCardVisual";
import { WaitlistForm } from "@/components/WaitlistForm";

export function Hero() {
  const reduce = useReducedMotion();
  const enter = (delay: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 28 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.8, delay, ease: [0.22, 1, 0.36, 1] as const },
        };

  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto grid max-w-6xl gap-14 px-6 pt-24 pb-20 md:grid-cols-2 md:items-center md:pt-32">
        <div>
          <motion.p {...enter(0)} className="font-numbers text-xs tracking-[0.3em] text-accent-2 uppercase">
            Built on Solana · Devnet beta
          </motion.p>
          <motion.h1
            {...enter(0.08)}
            className="font-display mt-5 text-5xl leading-[1.02] font-semibold tracking-tight text-balance sm:text-6xl lg:text-7xl"
          >
            Spend what you own. Never sell it.
          </motion.h1>
          <motion.p {...enter(0.16)} className="mt-6 max-w-md text-lg leading-relaxed text-text-2">
            A credit card backed by tokenized stocks, graded cards, watches and art notes.
            Lock your assets, borrow against them, spend — and keep everything you own.
          </motion.p>
          <motion.div {...enter(0.24)} className="mt-8">
            <WaitlistForm id="hero" />
            <a
              href="#calculator"
              className="mt-4 inline-flex min-h-11 items-center text-sm font-medium text-accent-2 underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-accent focus:outline-none"
            >
              See how credit works ↓
            </a>
          </motion.div>
        </div>

        <motion.div
          {...(reduce
            ? {}
            : {
                initial: { opacity: 0, y: 40, rotate: 2 },
                animate: { opacity: 1, y: 0, rotate: 0 },
                transition: { duration: 1, delay: 0.2, ease: [0.22, 1, 0.36, 1] },
              })}
        >
          <StockCardVisual tier="black" />
          <p className="mt-4 text-center text-xs text-text-2">
            In development · Devnet beta · Not available yet
          </p>
        </motion.div>
      </div>
    </section>
  );
}
