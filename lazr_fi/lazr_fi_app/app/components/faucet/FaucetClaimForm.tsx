"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ExternalLink } from "lucide-react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import TokenIcon from "../TokenIcon";
import {
  getFaucetClaimAmount,
  getFaucetTokens,
  type FaucetToken,
} from "../../../lib/devnet-config";
import { formatFaucetClaimAmount } from "../../../lib/format-numbers";
import {
  HOME_FAUCET_MINTED_EVENT,
  type HomeFaucetMintedDetail,
} from "../../../lib/onboarding/home-tour-events";
import { useWalletBalances } from "../../hooks/useWalletBalances";

const FAUCET_TOKENS = getFaucetTokens();

function isValidSolanaAddress(value: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value.trim());
}

export default function FaucetClaimForm({
  variant = "page",
  onSuccess,
  onClose,
}: {
  variant?: "page" | "modal";
  onSuccess?: () => void;
  onClose?: () => void;
}) {
  const isModal = variant === "modal";
  const [selectedSymbol, setSelectedSymbol] = useState(
    isModal ? "USDC" : (FAUCET_TOKENS[0]?.symbol ?? "")
  );
  const [address, setAddress] = useState("");
  const [tokenMenuOpen, setTokenMenuOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">(
    "idle"
  );
  const [errorMessage, setErrorMessage] = useState("");
  const [txSignature, setTxSignature] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  const { publicKey, connected } = useWallet();
  const { setVisible } = useWalletModal();
  const { refresh: refreshWallet } = useWalletBalances();

  const selectedToken: FaucetToken | undefined = useMemo(
    () =>
      FAUCET_TOKENS.find((t) => t.symbol === selectedSymbol) ?? FAUCET_TOKENS[0],
    [selectedSymbol]
  );

  const claimAmount = selectedToken
    ? getFaucetClaimAmount(selectedToken.symbol)
    : 0;

  const recipientAddress = isModal
    ? publicKey?.toBase58() ?? ""
    : address.trim();

  useEffect(() => {
    if (!isModal && connected && publicKey) {
      setAddress(publicKey.toBase58());
    }
  }, [connected, publicKey, isModal]);

  useEffect(() => {
    if (!tokenMenuOpen) return;

    const handleClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setTokenMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [tokenMenuOpen]);

  const canClaim =
    recipientAddress.length > 0 &&
    isValidSolanaAddress(recipientAddress) &&
    !!selectedToken &&
    status !== "loading";

  const resetStatus = () => {
    setStatus("idle");
    setErrorMessage("");
    setTxSignature("");
  };

  const handleClaim = async () => {
    if (!canClaim || !selectedToken) return;

    setStatus("loading");
    setErrorMessage("");
    setTxSignature("");

    try {
      const res = await fetch("/api/faucet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: recipientAddress,
          symbol: selectedToken.symbol,
        }),
      });

      const data = (await res.json()) as {
        ok?: boolean;
        signature?: string;
        error?: string;
      };

      if (!res.ok || !data.ok || !data.signature) {
        throw new Error(data.error ?? "Faucet request failed.");
      }

      setTxSignature(data.signature);
      setStatus("success");
      await refreshWallet();
      window.dispatchEvent(
        new CustomEvent<HomeFaucetMintedDetail>(HOME_FAUCET_MINTED_EVENT, {
          detail: { symbol: selectedToken.symbol },
        })
      );
      onSuccess?.();
    } catch (err) {
      setStatus("error");
      setErrorMessage(
        err instanceof Error ? err.message : "Faucet request failed."
      );
    }
  };

  return (
    <div className={isModal ? "p-4 flex flex-col gap-3" : "p-6 flex flex-col gap-4"}>
      {isModal && (
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-foreground">Faucet</span>
          <span className="text-xs text-tertiary">Devnet test tokens</span>
        </div>
      )}

      {isModal ? (
        <div className="flex gap-2">
          <div ref={menuRef} className="relative flex-[0.65] min-w-0">
            <button
              type="button"
              onClick={() => setTokenMenuOpen((prev) => !prev)}
              className="w-full h-full min-h-[52px] flex items-center justify-between gap-2 rounded-xl bg-input border border-border hover:border-gold/30 transition-colors px-3 py-2.5"
              aria-expanded={tokenMenuOpen}
              aria-haspopup="listbox"
            >
              <div className="flex items-center gap-2 min-w-0">
                {selectedToken && (
                  <TokenIcon
                    token={selectedToken}
                    size={24}
                    showQuote={selectedToken.symbol !== "USDC"}
                  />
                )}
                <span className="text-sm font-semibold text-foreground">
                  {selectedToken?.ticker ?? "—"}
                </span>
              </div>
              <ChevronDown
                className={`w-4 h-4 text-secondary flex-shrink-0 transition-transform ${
                  tokenMenuOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {tokenMenuOpen && (
              <ul
                className="absolute left-0 right-0 top-full mt-1.5 z-10 rounded-xl border border-border bg-elevated py-1 shadow-lg max-h-64 overflow-y-auto"
                role="listbox"
              >
                {FAUCET_TOKENS.map((token) => (
                  <li key={token.symbol}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={token.symbol === selectedSymbol}
                      onClick={() => {
                        setSelectedSymbol(token.symbol);
                        setTokenMenuOpen(false);
                        resetStatus();
                      }}
                      className={`flex w-full items-center gap-2 px-3 py-2.5 text-sm transition-colors ${
                        token.symbol === selectedSymbol
                          ? "bg-hover text-foreground"
                          : "text-secondary hover:bg-hover hover:text-foreground"
                      }`}
                    >
                      <TokenIcon
                        token={token}
                        size={22}
                        showQuote={token.symbol !== "USDC"}
                      />
                      <span className="font-semibold">{token.ticker}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex-[0.35] min-w-0 rounded-xl bg-elevated/40 border border-border-subtle flex flex-col justify-center px-3 py-2.5 min-h-[52px]">
            <span className="text-[10px] text-secondary leading-none">Mint amount</span>
            <span className="mt-1 text-sm font-bold text-foreground font-mono tabular-nums truncate">
              {formatFaucetClaimAmount(claimAmount)}{" "}
              <span className="text-gold">{selectedToken?.ticker}</span>
            </span>
          </div>
        </div>
      ) : (
        <>
          <div>
            <label className="text-sm text-secondary mb-2 block">Token</label>
            <div ref={menuRef} className="relative">
              <button
                type="button"
                onClick={() => setTokenMenuOpen((prev) => !prev)}
                className="w-full flex items-center justify-between gap-3 rounded-xl bg-input border border-border hover:border-gold/30 transition-colors px-4 py-3"
                aria-expanded={tokenMenuOpen}
                aria-haspopup="listbox"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {selectedToken && (
                    <TokenIcon
                      token={selectedToken}
                      size={28}
                      showQuote={selectedToken.symbol !== "USDC"}
                    />
                  )}
                  <span className="text-sm font-semibold text-foreground">
                    {selectedToken?.ticker ?? "—"}
                  </span>
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-secondary flex-shrink-0 transition-transform ${
                    tokenMenuOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {tokenMenuOpen && (
                <ul
                  className="absolute left-0 right-0 top-full mt-1.5 z-10 rounded-xl border border-border bg-elevated py-1 shadow-lg max-h-64 overflow-y-auto"
                  role="listbox"
                >
                  {FAUCET_TOKENS.map((token) => (
                    <li key={token.symbol}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={token.symbol === selectedSymbol}
                        onClick={() => {
                          setSelectedSymbol(token.symbol);
                          setTokenMenuOpen(false);
                          resetStatus();
                        }}
                        className={`flex w-full items-center gap-2 px-3 py-2.5 text-sm transition-colors ${
                          token.symbol === selectedSymbol
                            ? "bg-hover text-foreground"
                            : "text-secondary hover:bg-hover hover:text-foreground"
                        }`}
                      >
                        <TokenIcon
                          token={token}
                          size={22}
                          showQuote={token.symbol !== "USDC"}
                        />
                        <span className="font-semibold">{token.ticker}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="rounded-xl bg-elevated/40 border border-border-subtle flex items-center justify-between px-4 py-3">
            <span className="text-sm text-secondary">Mint amount</span>
            <span className="text-sm font-bold text-foreground font-mono tabular-nums">
              {formatFaucetClaimAmount(claimAmount)}{" "}
              <span className="text-gold">{selectedToken?.ticker}</span>
            </span>
          </div>
        </>
      )}

      {!isModal && (
        <div>
          <label
            htmlFor="faucet-address"
            className="text-sm text-secondary mb-2 block"
          >
            Wallet address
          </label>
          <input
            id="faucet-address"
            type="text"
            value={address}
            onChange={(e) => {
              setAddress(e.target.value);
              resetStatus();
            }}
            placeholder="Paste your Solana address"
            className="w-full rounded-xl bg-input border border-border px-4 py-3 text-sm text-foreground placeholder:text-tertiary outline-none focus:border-gold/40 transition-colors font-mono"
          />
          {address.trim().length > 0 && !isValidSolanaAddress(address.trim()) && (
            <p className="text-xs text-red mt-1.5">Invalid Solana address.</p>
          )}
        </div>
      )}

      {status === "success" && (
        <div className="rounded-xl border border-green/25 bg-green/10 px-4 py-3 text-sm text-green">
          <p className="text-center">
            Sent {formatFaucetClaimAmount(claimAmount)} {selectedToken?.ticker}{" "}
            to your wallet.
          </p>
          {txSignature && (
            <a
              href={`https://solscan.io/tx/${txSignature}?cluster=devnet`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 flex items-center justify-center gap-1 text-xs text-green/90 hover:text-green underline"
            >
              View on Solscan
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      )}

      {status === "error" && (
        <div className="rounded-xl border border-red/25 bg-red/10 px-4 py-3 text-sm text-red text-center">
          {errorMessage}
        </div>
      )}

      {status !== "success" && (
        connected ? (
          <button
            type="button"
            onClick={handleClaim}
            disabled={!canClaim}
            className={`rounded-2xl bg-gradient-to-r from-gold-dark via-gold to-gold-light text-background font-bold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed ${
              isModal ? "h-11 text-base" : "h-12 text-base"
            }`}
          >
            {status === "loading"
              ? "Minting…"
              : `Mint ${formatFaucetClaimAmount(claimAmount)} ${selectedToken?.ticker}`}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setVisible(true)}
            className={`rounded-2xl bg-gradient-to-r from-gold-dark via-gold to-gold-light text-background font-bold hover:opacity-90 transition-opacity ${
              isModal ? "h-11 text-base" : "h-12 text-base"
            }`}
          >
            Connect wallet to mint
          </button>
        )
      )}

      {status === "success" && (
        isModal && onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="h-11 rounded-2xl bg-gradient-to-r from-gold-dark via-gold to-gold-light text-background text-base font-bold hover:opacity-90 transition-opacity"
          >
            Close
          </button>
        ) : (
          <button
            type="button"
            onClick={resetStatus}
            className={`rounded-2xl border border-border text-foreground font-semibold hover:bg-hover transition-colors ${
              isModal ? "h-11 text-sm" : "h-12 text-base"
            }`}
          >
            Mint another token
          </button>
        )
      )}

      <p
        className={`text-tertiary text-center leading-relaxed ${
          isModal ? "text-[10px]" : "text-[11px]"
        }`}
      >
        Devnet test tokens only. 30s cooldown per token.
      </p>
    </div>
  );
}
