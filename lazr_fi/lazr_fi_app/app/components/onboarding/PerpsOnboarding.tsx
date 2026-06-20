"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useIsDesktop } from "../../hooks/useIsDesktop";
import { useOptionalFlashTrade } from "../../providers/flash-trade-context";
import {
  buildPerpsTourSteps,
  PERPS_ENABLE_SHEET_EVENT,
  PERPS_TRADE_TAB_EVENT,
  type PerpsEnableSheetDetail,
  type PerpsTradeTabDetail,
} from "../../../lib/onboarding/perps-tour-steps";
import type { HomeTourStep } from "../../../lib/onboarding/home-tour-steps";
import {
  completePerpsTour,
  loadPerpsOnboarding,
  markPerpsTourStarted,
  shouldShowPerpsWelcome,
} from "../../../lib/onboarding/perps-storage";
import TourOverlay from "./TourOverlay";
import WelcomeModal from "./WelcomeModal";

const PERPS_WELCOME = {
  title: "",
  headerLabel: "Flash Trade Perps",
  description:
    "Trade leveraged perps on Flash Trade v2. You'll need real mainnet USDC in your wallet for margin deposits.",
  callout: {
    title: "Set your wallet to Solana Mainnet before you continue",
    body: "Open Phantom → Settings → Developer Settings and turn off Testnet Mode (or select Mainnet). PropAMM spot uses devnet; perps always use mainnet.",
  },
};

export default function PerpsOnboarding() {
  const isDesktop = useIsDesktop();
  const { connected } = useWallet();
  const flash = useOptionalFlashTrade();
  const [ready, setReady] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [tourActive, setTourActive] = useState(false);
  const [pendingTourStart, setPendingTourStart] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [enableSheetOpen, setEnableSheetOpen] = useState(false);
  const [tourSteps, setTourSteps] = useState<HomeTourStep[]>(() =>
    buildPerpsTourSteps({ isRegistered: false, connected: false })
  );

  const isRegistered = Boolean(flash?.ownerLoaded && flash?.isPerpsEnabled);

  useEffect(() => {
    const state = loadPerpsOnboarding();
    setShowWelcome(shouldShowPerpsWelcome(state));
    setTourActive(false);
    setStepIndex(0);
    setReady(true);
  }, []);

  useEffect(() => {
    const handleEnableSheet = (event: Event) => {
      const open = (event as CustomEvent<PerpsEnableSheetDetail>).detail?.open;
      setEnableSheetOpen(open === true);
    };
    window.addEventListener(PERPS_ENABLE_SHEET_EVENT, handleEnableSheet);
    return () =>
      window.removeEventListener(PERPS_ENABLE_SHEET_EVENT, handleEnableSheet);
  }, []);

  const dispatchTradeTab = useCallback((tab: PerpsTradeTabDetail["tab"]) => {
    window.dispatchEvent(
      new CustomEvent<PerpsTradeTabDetail>(PERPS_TRADE_TAB_EVENT, {
        detail: { tab },
      })
    );
  }, []);

  const beginTour = useCallback(() => {
    const registered = Boolean(flash?.ownerLoaded && flash?.isPerpsEnabled);
    setTourSteps(
      buildPerpsTourSteps({ isRegistered: registered, connected })
    );
    setTourActive(true);
    setStepIndex(0);
    setPendingTourStart(false);
  }, [flash?.ownerLoaded, flash?.isPerpsEnabled, connected]);

  useEffect(() => {
    if (!pendingTourStart) return;
    if (connected && flash && !flash.ownerLoaded) return;
    beginTour();
  }, [pendingTourStart, connected, flash, flash?.ownerLoaded, beginTour]);

  useLayoutEffect(() => {
    if (!tourActive || showWelcome || isDesktop !== true) return;
    const step = tourSteps[stepIndex];
    if (!step) return;

    if (step.id === "trade" || step.id === "coming-soon") {
      dispatchTradeTab("market");
    }
  }, [stepIndex, tourActive, showWelcome, isDesktop, tourSteps, dispatchTradeTab]);

  const handleStartTour = useCallback(() => {
    markPerpsTourStarted();
    setShowWelcome(false);
    if (isDesktop !== true) return;

    if (connected && flash && !flash.ownerLoaded) {
      setPendingTourStart(true);
      return;
    }
    beginTour();
  }, [isDesktop, connected, flash, beginTour]);

  const handleSkipWelcome = useCallback(() => {
    setShowWelcome(false);
    setTourActive(false);
    setPendingTourStart(false);
  }, []);

  const handleSkipTour = useCallback(() => {
    setTourActive(false);
  }, []);

  const handleNext = useCallback(() => {
    setStepIndex((i) => {
      const next = Math.min(i + 1, tourSteps.length - 1);
      if (tourSteps[next]?.id === "coming-soon") {
        dispatchTradeTab("market");
      }
      return next;
    });
  }, [tourSteps, dispatchTradeTab]);

  const handleComplete = useCallback(() => {
    setTourActive(false);
    completePerpsTour();
  }, []);

  if (!ready) return null;

  const onSetupStep = tourSteps[stepIndex]?.id === "setup";
  const hideTourOverlay = tourActive && onSetupStep && enableSheetOpen;

  return (
    <>
      <WelcomeModal
        open={showWelcome}
        onStartTour={handleStartTour}
        onSkip={handleSkipWelcome}
        title={PERPS_WELCOME.title}
        headerLabel={PERPS_WELCOME.headerLabel}
        description={PERPS_WELCOME.description}
        callout={PERPS_WELCOME.callout}
      />
      {pendingTourStart && !showWelcome && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none">
          <div className="rounded-xl border border-border bg-background px-4 py-3 text-sm text-secondary shadow-lg">
            Checking Flash Trade registration…
          </div>
        </div>
      )}
      {tourActive && !showWelcome && isDesktop === true && (
        <TourOverlay
          steps={tourSteps}
          stepIndex={stepIndex}
          onNext={handleNext}
          onSkip={handleSkipTour}
          onComplete={handleComplete}
          perpsEnabled={isRegistered}
          hidden={hideTourOverlay}
        />
      )}
    </>
  );
}
