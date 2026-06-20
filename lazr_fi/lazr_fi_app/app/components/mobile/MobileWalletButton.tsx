"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { Copy, LogOut } from "lucide-react";

function truncateAddress(address: string): string {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

export default function MobileWalletButton() {
  const { publicKey, connected, disconnect, connecting } = useWallet();
  const { setVisible } = useWalletModal();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleConnect = useCallback(() => {
    setVisible(true);
  }, [setVisible]);

  const handleDisconnect = useCallback(async () => {
    await disconnect();
    setMenuOpen(false);
  }, [disconnect]);

  const handleCopyAddress = useCallback(async () => {
    if (!publicKey) return;
    await navigator.clipboard.writeText(publicKey.toBase58());
    setMenuOpen(false);
  }, [publicKey]);

  useEffect(() => {
    if (!menuOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node)
      ) {
        setMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  if (connected && publicKey) {
    const address = publicKey.toBase58();

    return (
      <div className="relative shrink-0" ref={menuRef}>
        <button
          type="button"
          data-tour="connect-wallet"
          onClick={() => setMenuOpen((open) => !open)}
          className="text-xs font-semibold text-gold font-mono tabular-nums px-1 hover:text-gold-light transition-colors"
          aria-expanded={menuOpen}
          aria-haspopup="menu"
        >
          {truncateAddress(address)}
        </button>

        {menuOpen && (
          <div
            className="absolute right-0 top-full mt-1.5 w-44 rounded-xl border border-border bg-elevated shadow-[0_12px_32px_rgba(0,0,0,0.4)] z-50 py-1"
            role="menu"
          >
            <button
              type="button"
              onClick={handleCopyAddress}
              className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-foreground hover:bg-hover transition-colors"
              role="menuitem"
            >
              <Copy className="w-4 h-4 text-secondary" />
              Copy address
            </button>
            <button
              type="button"
              onClick={handleDisconnect}
              className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-red hover:bg-hover transition-colors"
              role="menuitem"
            >
              <LogOut className="w-4 h-4" />
              Disconnect
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      data-tour="connect-wallet"
      onClick={handleConnect}
      disabled={connecting}
      className="text-xs font-semibold text-gold hover:text-gold-light transition-colors disabled:opacity-60 px-1 shrink-0"
    >
      {connecting ? "…" : "Connect"}
    </button>
  );
}
