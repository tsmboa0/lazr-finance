"use client";

import { useEffect, useRef, useState } from "react";
import { Droplets } from "lucide-react";
import FaucetClaimForm from "./FaucetClaimForm";

export default function FaucetModal({
  variant = "header",
}: {
  variant?: "header" | "mobile";
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const isMobile = variant === "mobile";

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    const handleClick = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClick);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClick);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        data-tour="faucet"
        onClick={() => setOpen((prev) => !prev)}
        className={
          isMobile
            ? `p-1.5 rounded-lg transition-colors ${
                open ? "bg-elevated" : "hover:bg-elevated/50"
              }`
            : `flex items-center gap-1.5 px-2 py-1 rounded-lg text-md font-medium transition-colors whitespace-nowrap ${
                open
                  ? "text-foreground bg-elevated/70"
                  : "text-secondary hover:text-foreground hover:bg-elevated/40"
              }`
        }
        aria-label="Faucet"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Droplets
          className={`text-gold flex-shrink-0 ${
            isMobile ? "w-4 h-4" : "w-3.6 h-3.6"
          }`}
        />
        {!isMobile && "Faucet"}
      </button>

      {open && (
        <div
          className={`absolute top-full z-[100] pt-2 ${
            isMobile ? "right-0" : "left-0"
          }`}
        >
          <div
            className="w-[320px] rounded-2xl border border-border bg-background shadow-[0_16px_48px_rgba(0,0,0,0.45)]"
            role="dialog"
            aria-label="Faucet"
          >
            <FaucetClaimForm variant="modal" onClose={() => setOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
