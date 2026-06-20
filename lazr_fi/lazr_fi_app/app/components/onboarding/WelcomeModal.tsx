"use client";

type WelcomeModalProps = {
  open: boolean;
  onStartTour: () => void;
  onSkip: () => void;
  title?: string;
  description?: string;
  headerLabel?: string;
  /** Bold callout shown above the action buttons (e.g. mainnet reminder). */
  callout?: {
    title: string;
    body?: string;
  };
};

export default function WelcomeModal({
  open,
  onStartTour,
  onSkip,
  title = "Welcome to Lazr",
  description = "Trade spot swaps on our custom PropAMM and perps via Flash Trade. Take a quick tour to connect your wallet, grab test tokens, and jump into a market.",
  headerLabel = "LA⚡R",
  callout,
}: WelcomeModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" aria-hidden />

      <div
        role="dialog"
        aria-labelledby="welcome-title"
        aria-describedby="welcome-desc"
        className="relative w-full max-w-md overflow-hidden rounded-2xl border border-border bg-background shadow-[0_24px_64px_rgba(0,0,0,0.55)]"
      >
        <div className="relative flex flex-col items-center justify-center px-6 py-10 bg-gradient-to-r from-gold-dark via-gold to-gold-light">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.12),transparent_55%)]" />
          <span className="relative text-3xl font-extrabold tracking-tight text-background drop-shadow-sm">
            {headerLabel}
          </span>
        </div>

        <div className="px-6 py-6">
          <h2
            id="welcome-title"
            className="text-lg font-bold text-foreground text-center"
          >
            {title}
          </h2>
          <p
            id="welcome-desc"
            className="mt-3 text-sm text-secondary text-center leading-relaxed"
          >
            {description}
          </p>

          {callout && (
            <div
              className="mt-4 rounded-xl border-2 border-gold/50 bg-gold/10 px-4 py-3 text-center"
              role="note"
            >
              <p className="text-sm font-bold text-gold-light leading-snug">
                {callout.title}
              </p>
              {callout.body && (
                <p className="mt-1.5 text-xs text-secondary leading-relaxed">
                  {callout.body}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="px-6 pb-6 flex flex-col gap-2">
          <button
            type="button"
            onClick={onStartTour}
            className="h-11 w-full rounded-xl bg-gradient-to-r from-gold-dark via-gold to-gold-light text-background text-sm font-bold hover:opacity-90 transition-opacity"
          >
            Start Tour
          </button>
          <button
            type="button"
            onClick={onSkip}
            className="h-10 w-full rounded-xl text-sm font-medium text-secondary hover:text-foreground hover:bg-hover transition-colors"
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
}
