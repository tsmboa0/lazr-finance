"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { Copy, LogOut } from "lucide-react";

function truncateAddress(address: string): string {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

export default function WalletConnectButton() {
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
      <div className="relative" ref={menuRef}>
        <button
          type="button"
          data-tour="connect-wallet"
          onClick={() => setMenuOpen((open) => !open)}
          className="h-10 px-5 rounded-xl border border-gold/60 bg-gold/10 text-gold text-base font-semibold hover:bg-gold/15 transition-colors font-mono"
          aria-expanded={menuOpen}
          aria-haspopup="menu"
        >
          {truncateAddress(address)}
        </button>

        {menuOpen && (
          <div
            className="absolute right-0 top-full mt-2 w-52 rounded-xl border border-border bg-elevated shadow-lg z-50 py-1"
            role="menu"
          >
            <button
              type="button"
              onClick={handleCopyAddress}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-foreground hover:bg-hover transition-colors"
              role="menuitem"
            >
              <Copy className="w-4 h-4 text-secondary" />
              Copy address
            </button>
            <button
              type="button"
              onClick={handleDisconnect}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-red hover:bg-hover transition-colors"
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
      className="h-10 px-6 rounded-xl border border-gold/60 text-gold text-base font-semibold hover:bg-gold/10 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {connecting ? "Connecting..." : "Connect"}
    </button>
  );
}
