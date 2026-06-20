const STORAGE_KEY = "lazr-propamm-onboarding";

export type PropAmmOnboardingState = {
  tourStarted: boolean;
  tourComplete: boolean;
};

const DEFAULT_STATE: PropAmmOnboardingState = {
  tourStarted: false,
  tourComplete: false,
};

export function loadPropAmmOnboarding(): PropAmmOnboardingState {
  if (typeof window === "undefined") return DEFAULT_STATE;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return DEFAULT_STATE;
  try {
    const parsed = JSON.parse(raw) as Partial<PropAmmOnboardingState>;
    return {
      tourStarted: parsed.tourStarted === true,
      tourComplete: parsed.tourComplete === true,
    };
  } catch {
    return DEFAULT_STATE;
  }
}

export function savePropAmmOnboarding(state: PropAmmOnboardingState): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function markPropAmmTourStarted(): void {
  const current = loadPropAmmOnboarding();
  savePropAmmOnboarding({ ...current, tourStarted: true });
}

export function completePropAmmTour(): void {
  savePropAmmOnboarding({
    tourStarted: true,
    tourComplete: true,
  });
}

export function shouldShowPropAmmWelcome(
  state: PropAmmOnboardingState
): boolean {
  return !state.tourComplete;
}
