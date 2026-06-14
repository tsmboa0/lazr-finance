import type { LeaderSelection } from "./types";

const STORAGE_KEY = "lazr-copy-leader";

export function loadLeaderSelection(): LeaderSelection | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as LeaderSelection;
    if (parsed?.kind === "curated" && parsed.address && parsed.leaderId) {
      return parsed;
    }
    if (parsed?.kind === "custom" && parsed.address) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveLeaderSelection(selection: LeaderSelection | null): void {
  if (typeof window === "undefined") return;
  if (!selection) {
    window.localStorage.removeItem(STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(selection));
}
