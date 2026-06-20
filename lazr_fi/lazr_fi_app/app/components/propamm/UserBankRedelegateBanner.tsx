"use client";

type UserBankRedelegateBannerProps = {
  needsRedelegate: boolean;
  loading?: boolean;
  error?: string | null;
  onRedelegate: () => void | Promise<void>;
  className?: string;
  /** Shown in deposit/withdraw modal after a cancelled funds tx. */
  variant?: "funds" | "swap";
};

export default function UserBankRedelegateBanner({
  needsRedelegate,
  loading = false,
  error,
  onRedelegate,
  className = "",
  variant = "swap",
}: UserBankRedelegateBannerProps) {
  if (!needsRedelegate) return null;

  const message =
    variant === "funds"
      ? "You cancelled before finishing. Your bank is on L1 only — re-delegate it to the rollup to resume swapping."
      : "Your bank is on L1 only, so spot swaps are paused until you re-delegate it to the rollup.";

  return (
    <div
      className={`rounded-xl border border-red/25 bg-red/10 px-3 py-2.5 ${className}`}
    >
      <p className="text-xs text-red leading-relaxed">{message}</p>
      {error && (
        <p className="mt-1.5 text-[11px] text-red/90 leading-relaxed">{error}</p>
      )}
      <button
        type="button"
        onClick={() => void onRedelegate()}
        disabled={loading}
        className="mt-2 w-full h-9 rounded-lg border border-red/30 bg-red/15 text-red text-xs font-bold hover:bg-red/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {loading ? "Re-delegating…" : "Re-delegate to resume swapping"}
      </button>
    </div>
  );
}
