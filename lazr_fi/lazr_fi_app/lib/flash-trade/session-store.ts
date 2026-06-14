import { Keypair } from "@solana/web3.js";

export const SESSION_STORAGE_KEY = "lazr-flash-session";

export interface LoadedSession {
  keypair: Keypair;
  token: string;
  authority: string;
  validUntil: number;
}

interface StoredSession {
  secretKey: number[];
  token: string;
  authority: string;
  validUntil: number;
}

export function loadSession(authority?: string): LoadedSession | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
  if (!raw) return null;
  try {
    const stored = JSON.parse(raw) as StoredSession;
    const fresh = stored.validUntil > Date.now() / 1000 + 60;
    const mine = !authority || stored.authority === authority;
    if (!fresh || !mine) {
      if (!fresh) clearSession();
      return null;
    }
    return {
      keypair: Keypair.fromSecretKey(Uint8Array.from(stored.secretKey)),
      token: stored.token,
      authority: stored.authority,
      validUntil: stored.validUntil,
    };
  } catch {
    clearSession();
    return null;
  }
}

export function clearSession(): void {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
  }
}

export function persistSession(args: {
  sessionSigner: Keypair;
  sessionToken: string;
  authority: string;
  validUntil: number;
}): LoadedSession {
  const stored: StoredSession = {
    secretKey: Array.from(args.sessionSigner.secretKey),
    token: args.sessionToken,
    authority: args.authority,
    validUntil: args.validUntil,
  };
  window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(stored));
  return {
    keypair: args.sessionSigner,
    token: stored.token,
    authority: stored.authority,
    validUntil: stored.validUntil,
  };
}
