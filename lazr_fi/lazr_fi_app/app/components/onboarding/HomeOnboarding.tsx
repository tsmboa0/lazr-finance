"use client";

import { useCallback, useEffect, useState } from "react";
import { HOME_TOUR_STEPS } from "../../../lib/onboarding/home-tour-steps";
import {
  completeHomeTour,
  markTourStarted,
  shouldShowWelcome,
  loadHomeOnboarding,
} from "../../../lib/onboarding/storage";
import TourOverlay from "./TourOverlay";
import WelcomeModal from "./WelcomeModal";

export default function HomeOnboarding() {
  const [ready, setReady] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [tourActive, setTourActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    const state = loadHomeOnboarding();
    setShowWelcome(shouldShowWelcome(state));
    setTourActive(false);
    setStepIndex(0);
    setReady(true);
  }, []);

  const handleStartTour = useCallback(() => {
    markTourStarted();
    setShowWelcome(false);
    setTourActive(true);
    setStepIndex(0);
  }, []);

  const handleSkipWelcome = useCallback(() => {
    setShowWelcome(false);
    setTourActive(false);
  }, []);

  const handleSkipTour = useCallback(() => {
    setTourActive(false);
  }, []);

  const handleNext = useCallback(() => {
    setStepIndex((i) => Math.min(i + 1, HOME_TOUR_STEPS.length - 1));
  }, []);

  const handleComplete = useCallback(() => {
    setTourActive(false);
    completeHomeTour();
  }, []);

  if (!ready) return null;

  return (
    <>
      <WelcomeModal
        open={showWelcome}
        onStartTour={handleStartTour}
        onSkip={handleSkipWelcome}
      />
      {tourActive && !showWelcome && (
        <TourOverlay
          steps={HOME_TOUR_STEPS}
          stepIndex={stepIndex}
          onNext={handleNext}
          onSkip={handleSkipTour}
          onComplete={handleComplete}
        />
      )}
    </>
  );
}
