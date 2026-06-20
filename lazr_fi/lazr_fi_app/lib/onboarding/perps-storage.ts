const STORAGE_KEY = "lazr-perps-onboarding";

export type PerpsOnboardingState = {
  tourStarted: boolean;
  tourComplete: boolean;
};

const DEFAULT_STATE: PerpsOnboardingState = {
  tourStarted: false,
  tourComplete: false,
};

export function loadPerpsOnboarding(): PerpsOnboardingState {
  if (typeof window === "undefined") return DEFAULT_STATE;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return DEFAULT_STATE;
  try {
    const parsed = JSON.parse(raw) as Partial<PerpsOnboardingState>;
    return {
      tourStarted: parsed.tourStarted === true,
      tourComplete: parsed.tourComplete === true,
    };
  } catch {
    return DEFAULT_STATE;
  }
}

export function savePerpsOnboarding(state: PerpsOnboardingState): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function markPerpsTourStarted(): void {
  const current = loadPerpsOnboarding();
  savePerpsOnboarding({ ...current, tourStarted: true });
}

export function completePerpsTour(): void {
  savePerpsOnboarding({
    tourStarted: true,
    tourComplete: true,
  });
}

export function shouldShowPerpsWelcome(state: PerpsOnboardingState): boolean {
  return !state.tourComplete;
}
