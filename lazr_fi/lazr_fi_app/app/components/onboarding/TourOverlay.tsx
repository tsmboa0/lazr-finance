"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { X } from "lucide-react";
import type { HomeTourStep } from "../../../lib/onboarding/home-tour-steps";
import {
  HOME_DEPOSIT_COMPLETED_EVENT,
  HOME_FAUCET_MINTED_EVENT,
  HOME_TOUR_OPEN_DEPOSIT_MENU_EVENT,
  type HomeDepositCompletedDetail,
  type HomeFaucetMintedDetail,
} from "../../../lib/onboarding/home-tour-events";
import {
  activateTourTargets,
  getTourSpotlight,
  scrollTargetIntoView,
  type SpotlightRect,
} from "../../../lib/onboarding/tour-utils";

type TourOverlayProps = {
  steps: HomeTourStep[];
  stepIndex: number;
  onNext: () => void;
  onSkip: () => void;
  onComplete: () => void;
  /** Flash Trade basket registered — used for perps setup step. */
  perpsEnabled?: boolean;
  /** Hide visually while a modal above the tour needs focus (e.g. enable sheet). */
  hidden?: boolean;
};

const TOOLTIP_GAP = 16;
const VIEWPORT_PAD = 12;

function spotlightStyle(rect: SpotlightRect): CSSProperties {
  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
    borderRadius: rect.borderRadius,
  };
}

function computeTooltipStyle(
  rect: SpotlightRect,
  placement: HomeTourStep["placement"],
  tooltipEl: HTMLDivElement | null
): CSSProperties {
  const tooltipW = tooltipEl?.offsetWidth ?? 320;
  const tooltipH = tooltipEl?.offsetHeight ?? 180;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let top = rect.top + rect.height + TOOLTIP_GAP;
  let left = rect.left + rect.width / 2 - tooltipW / 2;

  if (placement === "top") {
    top = rect.top - tooltipH - TOOLTIP_GAP;
  } else if (placement === "left") {
    top = rect.top + rect.height / 2 - tooltipH / 2;
    left = rect.left - tooltipW - TOOLTIP_GAP;
  } else if (placement === "right") {
    top = rect.top + rect.height / 2 - tooltipH / 2;
    left = rect.left + rect.width + TOOLTIP_GAP;
  }

  left = Math.max(
    VIEWPORT_PAD,
    Math.min(left, vw - tooltipW - VIEWPORT_PAD)
  );
  top = Math.max(
    VIEWPORT_PAD,
    Math.min(top, vh - tooltipH - VIEWPORT_PAD)
  );

  return { top, left, width: tooltipW };
}

export default function TourOverlay({
  steps,
  stepIndex,
  onNext,
  onSkip,
  onComplete,
  perpsEnabled = false,
  hidden = false,
}: TourOverlayProps) {
  const step = steps[stepIndex];
  const { connected } = useWallet();
  const [rect, setRect] = useState<SpotlightRect | null>(null);
  const [tooltipStyle, setTooltipStyle] = useState<CSSProperties>({});
  const [tooltipRef, setTooltipRef] = useState<HTMLDivElement | null>(null);
  const [spotlightDismissed, setSpotlightDismissed] = useState(false);
  const [actionComplete, setActionComplete] = useState(false);
  const deactivateRef = useRef<(() => void) | null>(null);

  const showSpotlight = Boolean(step?.target) && (!step?.waitForAction || !spotlightDismissed);
  const effectiveTarget = showSpotlight ? (step?.target ?? "") : "";

  const showActionDim =
    Boolean(step?.waitForAction) && spotlightDismissed && !actionComplete;

  const showTourTooltip = !(
    Boolean(step?.waitForAction) && (spotlightDismissed || actionComplete)
  );

  const pendingActionHint = (() => {
    if (!step?.waitForAction || actionComplete || spotlightDismissed) return null;
    return step.actionHint ?? "Click the highlighted element above to continue.";
  })();

  const isLast = stepIndex === steps.length - 1;
  const walletReady = !step?.waitForWallet || connected;
  const canAdvance = (() => {
    if (!walletReady) return false;
    if (step?.waitForAction) return actionComplete;
    if (step?.waitForPerpsEnabled) return perpsEnabled;
    if (step?.waitForTargetClick) return false;
    return true;
  })();

  const showActionHint =
    Boolean(pendingActionHint) ||
    (step?.waitForTargetClick && !step.waitForPerpsEnabled) ||
    (step?.waitForPerpsEnabled && !perpsEnabled);

  const updateRect = useCallback(() => {
    if (!step || !showSpotlight || !effectiveTarget) {
      deactivateRef.current?.();
      deactivateRef.current = null;
      setRect(null);
      return;
    }

    deactivateRef.current?.();
    deactivateRef.current = null;

    const { rect: spotlightRect, elements } = getTourSpotlight(effectiveTarget);

    if (!spotlightRect || elements.length === 0) {
      setRect(null);
      return;
    }

    deactivateRef.current = activateTourTargets(elements);
    setRect(spotlightRect);
  }, [step, showSpotlight, effectiveTarget]);

  useEffect(() => {
    setSpotlightDismissed(false);
    setActionComplete(false);
  }, [stepIndex]);

  useEffect(() => {
    if (!step?.waitForAction) return;

    const handleFaucetMinted = (event: Event) => {
      if (step.waitForAction !== "faucet-usdc") return;
      const { symbol } =
        (event as CustomEvent<HomeFaucetMintedDetail>).detail ?? {};
      if (symbol === "USDC") {
        setActionComplete(true);
      }
    };

    const handleDepositCompleted = (event: Event) => {
      if (step.waitForAction !== "deposit-usdc") return;
      const detail =
        (event as CustomEvent<HomeDepositCompletedDetail>).detail ?? {};
      if (
        detail.symbol === "USDC" &&
        detail.kind === "deposit" &&
        detail.venue === "propamm"
      ) {
        setActionComplete(true);
      }
    };

    window.addEventListener(HOME_FAUCET_MINTED_EVENT, handleFaucetMinted);
    window.addEventListener(HOME_DEPOSIT_COMPLETED_EVENT, handleDepositCompleted);
    return () => {
      window.removeEventListener(HOME_FAUCET_MINTED_EVENT, handleFaucetMinted);
      window.removeEventListener(
        HOME_DEPOSIT_COMPLETED_EVENT,
        handleDepositCompleted
      );
    };
  }, [step?.waitForAction, stepIndex]);

  useEffect(() => {
    if (step?.waitForAction && actionComplete) {
      const timer = window.setTimeout(onNext, 600);
      return () => window.clearTimeout(timer);
    }
  }, [actionComplete, step?.waitForAction, onNext]);

  useEffect(() => {
    if (!step?.waitForAction || spotlightDismissed || actionComplete) return;

    const attach = () => {
      const { elements } = getTourSpotlight(step.target);
      const target = elements[0];
      if (!target) return undefined;

      const handleClick = () => {
        setSpotlightDismissed(true);
        if (step.waitForAction === "deposit-usdc") {
          window.dispatchEvent(
            new CustomEvent(HOME_TOUR_OPEN_DEPOSIT_MENU_EVENT)
          );
        }
      };

      target.addEventListener("click", handleClick);
      return () => target.removeEventListener("click", handleClick);
    };

    let cleanup = attach();
    const retry = window.setTimeout(() => {
      cleanup?.();
      cleanup = attach();
    }, 100);

    return () => {
      window.clearTimeout(retry);
      cleanup?.();
    };
  }, [step, stepIndex, spotlightDismissed, actionComplete]);

  useLayoutEffect(() => {
    if (!step || !showSpotlight) return;
    const { elements } = getTourSpotlight(effectiveTarget);
    if (elements[0]) scrollTargetIntoView(elements[0]);
    const frame = requestAnimationFrame(updateRect);
    return () => cancelAnimationFrame(frame);
  }, [step, stepIndex, showSpotlight, effectiveTarget, updateRect]);

  useEffect(() => {
    if (!step) return;

    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect, true);

    const { elements } = getTourSpotlight(effectiveTarget);
    let observer: ResizeObserver | undefined;
    if (elements.length > 0 && typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(updateRect);
      for (const el of elements) observer.observe(el);
    }

    const retryTimers = [50, 150, 300].map((ms) =>
      window.setTimeout(updateRect, ms)
    );

    return () => {
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect, true);
      observer?.disconnect();
      retryTimers.forEach((id) => window.clearTimeout(id));
      deactivateRef.current?.();
      deactivateRef.current = null;
    };
  }, [step, stepIndex, showSpotlight, effectiveTarget, updateRect]);

  useLayoutEffect(() => {
    if (!rect || !tooltipRef) return;
    setTooltipStyle(
      computeTooltipStyle(rect, step?.placement ?? "bottom", tooltipRef)
    );
  }, [rect, tooltipRef, step?.placement]);

  useEffect(() => {
    if (step?.waitForWallet && connected) {
      const timer = window.setTimeout(onNext, 600);
      return () => window.clearTimeout(timer);
    }
  }, [connected, step?.waitForWallet, onNext]);

  useEffect(() => {
    if (step?.waitForPerpsEnabled && perpsEnabled) {
      const timer = window.setTimeout(onNext, 600);
      return () => window.clearTimeout(timer);
    }
  }, [perpsEnabled, step?.waitForPerpsEnabled, onNext]);

  useEffect(() => {
    if (!step?.waitForTargetClick || step.waitForPerpsEnabled) return;

    const attach = () => {
      const { elements } = getTourSpotlight(step.target);
      const target = elements[0];
      if (!target) return undefined;

      const handleClick = () => {
        window.setTimeout(onNext, 400);
      };

      target.addEventListener("click", handleClick);
      return () => target.removeEventListener("click", handleClick);
    };

    let cleanup = attach();
    const retry = window.setTimeout(() => {
      cleanup?.();
      cleanup = attach();
    }, 100);

    return () => {
      window.clearTimeout(retry);
      cleanup?.();
    };
  }, [step, stepIndex, onNext]);

  if (!step) return null;

  const handlePrimary = () => {
    if (isLast) {
      onComplete();
    } else {
      onNext();
    }
  };

  return (
    <>
      {showActionDim && (
        <div
          className="fixed inset-0 z-[94] bg-black/72 pointer-events-none transition-opacity duration-300"
          aria-hidden
        />
      )}

      <div
        className={`fixed inset-0 z-[95] pointer-events-none transition-opacity duration-200 ${
          hidden ? "opacity-0 invisible" : "opacity-100 visible"
        }`}
        aria-live="polite"
        aria-hidden={hidden}
      >
      {rect && (
        <>
          <div
            className="absolute tour-spotlight-backdrop transition-all duration-300 ease-out"
            style={spotlightStyle(rect)}
          />
          <div
            className="absolute tour-spotlight-glow transition-all duration-300 ease-out"
            style={spotlightStyle(rect)}
          />
          <div
            className="absolute tour-spotlight-ring transition-all duration-300 ease-out"
            style={spotlightStyle(rect)}
          />
        </>
      )}

      {showTourTooltip && (
      <div
        ref={setTooltipRef}
        role="dialog"
        aria-label={`Tour step ${stepIndex + 1} of ${steps.length}`}
        className="fixed z-[101] w-[min(100vw-24px,340px)] rounded-2xl border border-gold/30 bg-background shadow-[0_24px_64px_rgba(0,0,0,0.5)] pointer-events-auto"
        style={tooltipStyle}
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gold">
              Step {stepIndex + 1} of {steps.length}
            </p>
            <h3 className="mt-1 text-base font-bold text-foreground">
              {step.title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onSkip}
            className="p-1.5 rounded-lg text-tertiary hover:text-foreground hover:bg-hover transition-colors shrink-0"
            aria-label="Skip tour"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="px-5 pb-4 text-sm text-secondary leading-relaxed">
          {step.body}
        </p>

        {step.waitForWallet && !connected && (
          <p className="mx-5 mb-4 text-xs text-gold bg-gold/10 border border-gold/20 rounded-xl px-3 py-2">
            Click Connect in the highlight above, then approve in your wallet.
          </p>
        )}

        {showActionHint && (
          <p className="mx-5 mb-4 text-xs text-gold bg-gold/10 border border-gold/20 rounded-xl px-3 py-2">
            {pendingActionHint ??
              step.actionHint ??
              "Click the highlighted element above to continue."}
          </p>
        )}

        <div className="px-5 pb-5 flex items-center gap-2">
          <button
            type="button"
            onClick={onSkip}
            className="flex-1 h-10 rounded-xl text-sm font-medium text-secondary hover:text-foreground hover:bg-hover transition-colors"
          >
            Skip tour
          </button>
          <button
            type="button"
            onClick={handlePrimary}
            disabled={!canAdvance}
            className="flex-1 h-10 rounded-xl bg-gradient-to-r from-gold-dark via-gold to-gold-light text-background text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isLast ? "Finish" : "Next"}
          </button>
        </div>

        <div className="flex items-center justify-center gap-1.5 pb-4">
          {steps.map((s, i) => (
            <span
              key={s.id}
              className={`h-1.5 rounded-full transition-all ${
                i === stepIndex
                  ? "w-5 bg-gold"
                  : i < stepIndex
                    ? "w-1.5 bg-gold/50"
                    : "w-1.5 bg-border"
              }`}
            />
          ))}
        </div>
      </div>
      )}
      </div>
    </>
  );
}
