"use client";

import { useEffect } from "react";
import { Check } from "lucide-react";

export default function ShortToast({
  message,
  onDismiss,
  durationMs = 2000,
}: {
  message: string;
  onDismiss: () => void;
  durationMs?: number;
}) {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, durationMs);
    return () => window.clearTimeout(timer);
  }, [onDismiss, durationMs]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 left-1/2 z-[100] -translate-x-1/2 flex items-center gap-2 rounded-xl border border-green/30 bg-elevated px-4 py-3 text-sm font-medium text-foreground shadow-[0_12px_40px_rgba(0,0,0,0.45)]"
    >
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green/15 text-green">
        <Check className="h-3.5 w-3.5" />
      </span>
      <span>{message}</span>
    </div>
  );
}
