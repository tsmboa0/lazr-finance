"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { useIsDesktop } from "../../hooks/useIsDesktop";
import {
  PROPAMM_SWAP_TAB_EVENT,
  PROPAMM_TOUR_STEPS,
  type PropAmmSwapTabDetail,
} from "../../../lib/onboarding/propamm-tour-steps";
import {
  completePropAmmTour,
  loadPropAmmOnboarding,
  markPropAmmTourStarted,
  shouldShowPropAmmWelcome,
} from "../../../lib/onboarding/propamm-storage";
import TourOverlay from "./TourOverlay";
import WelcomeModal from "./WelcomeModal";

const PROPAMM_WELCOME = {
  title: "",
  headerLabel: "Lazr  PropAMM",
  description:
    "Swap spot on Lazr's custom PropAMM. Before you trade, connect your wallet, mint test tokens from the Faucet page, and deposit at least USDC into your bank — then you're ready to swap.",
};

export default function PropAmmOnboarding() {
  const isDesktop = useIsDesktop();
  const [ready, setReady] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [tourActive, setTourActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    const state = loadPropAmmOnboarding();
    setShowWelcome(shouldShowPropAmmWelcome(state));
    setTourActive(false);
    setStepIndex(0);
    setReady(true);
  }, []);

  const dispatchSwapTab = useCallback((tab: PropAmmSwapTabDetail["tab"]) => {
    window.dispatchEvent(
      new CustomEvent<PropAmmSwapTabDetail>(PROPAMM_SWAP_TAB_EVENT, {
        detail: { tab },
      })
    );
  }, []);

  useLayoutEffect(() => {
    if (!tourActive || showWelcome || isDesktop !== true) return;
    const step = PROPAMM_TOUR_STEPS[stepIndex];
    if (!step) return;

    if (step.id === "swap" || step.id === "perps-nav") {
      dispatchSwapTab("Market");
    }
  }, [stepIndex, tourActive, showWelcome, isDesktop, dispatchSwapTab]);

  const handleStartTour = useCallback(() => {
    markPropAmmTourStarted();
    setShowWelcome(false);
    if (isDesktop === true) {
      setTourActive(true);
      setStepIndex(0);
    }
  }, [isDesktop]);

  const handleSkipWelcome = useCallback(() => {
    setShowWelcome(false);
    setTourActive(false);
  }, []);

  const handleSkipTour = useCallback(() => {
    setTourActive(false);
  }, []);

  const handleNext = useCallback(() => {
    setStepIndex((i) => {
      const next = Math.min(i + 1, PROPAMM_TOUR_STEPS.length - 1);
      if (PROPAMM_TOUR_STEPS[next]?.id === "perps-nav") {
        dispatchSwapTab("Market");
      }
      return next;
    });
  }, [dispatchSwapTab]);

  const handleComplete = useCallback(() => {
    setTourActive(false);
    completePropAmmTour();
  }, []);

  if (!ready) return null;

  return (
    <>
      <WelcomeModal
        open={showWelcome}
        onStartTour={handleStartTour}
        onSkip={handleSkipWelcome}
        title={PROPAMM_WELCOME.title}
        headerLabel={PROPAMM_WELCOME.headerLabel}
        description={PROPAMM_WELCOME.description}
      />
      {tourActive && !showWelcome && isDesktop === true && (
        <TourOverlay
          steps={PROPAMM_TOUR_STEPS}
          stepIndex={stepIndex}
          onNext={handleNext}
          onSkip={handleSkipTour}
          onComplete={handleComplete}
        />
      )}
    </>
  );
}
