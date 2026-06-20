const STORAGE_KEY = "lazr-home-onboarding";

export type HomeOnboardingState = {
  /** User clicked Start Tour at least once. */
  tourStarted: boolean;
  /** User finished all tour steps. */
  tourComplete: boolean;
};

const DEFAULT_STATE: HomeOnboardingState = {
  tourStarted: false,
  tourComplete: false,
};

export function loadHomeOnboarding(): HomeOnboardingState {
  if (typeof window === "undefined") return DEFAULT_STATE;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return DEFAULT_STATE;
  try {
    const parsed = JSON.parse(raw) as Partial<
      HomeOnboardingState & { welcomeDismissed?: boolean }
    >;
    return {
      tourStarted: parsed.tourStarted === true,
      tourComplete: parsed.tourComplete === true,
    };
  } catch {
    return DEFAULT_STATE;
  }
}

export function saveHomeOnboarding(state: HomeOnboardingState): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function markTourStarted(): void {
  const current = loadHomeOnboarding();
  saveHomeOnboarding({ ...current, tourStarted: true });
}

export function completeHomeTour(): void {
  saveHomeOnboarding({
    tourStarted: true,
    tourComplete: true,
  });
}

/** Welcome modal shows on every visit until the tour is completed. */
export function shouldShowWelcome(state: HomeOnboardingState): boolean {
  return !state.tourComplete;
}
