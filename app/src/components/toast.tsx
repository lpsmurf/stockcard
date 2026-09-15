"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { ExplorerLink } from "./explorer-link";

interface Toast {
  id: number;
  message: string;
  sig?: string;
  variant: "success" | "error";
}

const ToastContext = createContext<{ toast: (message: string, opts?: { sig?: string; variant?: "success" | "error" }) => void }>({
  toast: () => {},
});

export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toast = useCallback((message: string, opts?: { sig?: string; variant?: "success" | "error" }) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, sig: opts?.sig, variant: opts?.variant ?? "success" }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 6000);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4 md:bottom-6" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex max-w-sm items-center gap-3 rounded-xl border px-4 py-3 text-sm shadow-lg ${
              t.variant === "error" ? "border-bad/40 bg-surface text-bad" : "border-good/40 bg-surface text-ink"
            }`}
          >
            <span>{t.message}</span>
            {t.sig ? <ExplorerLink sig={t.sig} /> : null}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
