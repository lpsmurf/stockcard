"use client";

import { useState } from "react";
import { FAQ } from "@/data/faq";

export function Faq() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section aria-labelledby="faq-heading" className="border-y border-line bg-surface py-24">
      <div className="mx-auto max-w-3xl px-6">
        <h2 id="faq-heading" className="font-display text-3xl font-semibold tracking-tight sm:text-5xl">
          Questions, answered.
        </h2>
        <div className="mt-10 divide-y divide-line rounded-2xl border border-line bg-ground">
          {FAQ.map((item, i) => {
            const isOpen = open === i;
            return (
              <div key={item.question}>
                <h3>
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={`faq-panel-${i}`}
                    id={`faq-button-${i}`}
                    onClick={() => setOpen(isOpen ? null : i)}
                    className="flex min-h-11 w-full items-center justify-between gap-4 px-5 py-4 text-left text-sm font-medium text-text transition-colors hover:text-accent-2 focus-visible:ring-2 focus-visible:ring-accent focus:outline-none"
                  >
                    {item.question}
                    <span aria-hidden className={`font-numbers text-text-2 transition-transform ${isOpen ? "rotate-45" : ""}`}>
                      +
                    </span>
                  </button>
                </h3>
                <div
                  id={`faq-panel-${i}`}
                  role="region"
                  aria-labelledby={`faq-button-${i}`}
                  hidden={!isOpen}
                  className="px-5 pb-5 text-sm leading-relaxed text-text-2"
                >
                  {item.answer}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
