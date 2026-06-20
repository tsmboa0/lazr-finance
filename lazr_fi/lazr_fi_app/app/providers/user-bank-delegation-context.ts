"use client";

import { createContext, useContext } from "react";

export type UserBankDelegationContextValue = {
  needsRedelegate: boolean;
  checking: boolean;
  redelegateLoading: boolean;
  redelegateError: string | null;
  redelegate: () => Promise<{ signature: string }>;
  refresh: () => Promise<void>;
  clearRedelegateError: () => void;
};

export const UserBankDelegationContext =
  createContext<UserBankDelegationContextValue | null>(null);

export function useUserBankDelegation(): UserBankDelegationContextValue {
  const ctx = useContext(UserBankDelegationContext);
  if (!ctx) {
    throw new Error(
      "useUserBankDelegation must be used within UserBankDelegationProvider"
    );
  }
  return ctx;
}
