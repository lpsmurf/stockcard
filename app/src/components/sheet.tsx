"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";

/** Bottom sheet on mobile, centered dialog on desktop. Focus trap, Esc closes, safe-area padding. */
export function Sheet({ title, children, onClose }: { title: string; children: ReactNode; onClose?: () => void }) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const close = () => (onClose ? onClose() : router.back());

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
        return;
      }
      if (e.key === "Tab" && ref.current) {
        const focusables = ref.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    ref.current?.querySelector<HTMLElement>("input, button")?.focus();
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/40 md:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <button aria-label="Close" className="absolute inset-0 cursor-default" onClick={close} tabIndex={-1} />
      <div
        ref={ref}
        className="relative w-full max-w-md rounded-t-2xl bg-surface p-5 pb-8 shadow-xl md:max-w-[480px] md:rounded-2xl"
        style={{ paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-rule md:hidden" aria-hidden />
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl">{title}</h2>
          <button onClick={close} aria-label="Close sheet" className="flex h-11 w-11 items-center justify-center rounded-full text-ink-2 hover:bg-plaster">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
