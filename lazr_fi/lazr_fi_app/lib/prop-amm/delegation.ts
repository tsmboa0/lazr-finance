import { PublicKey, type Connection } from "@solana/web3.js";
import { PROGRAM_ID, MAGIC_ROUTER_ENDPOINT, ER_ENDPOINT, ER_VALIDATOR } from "./constants";
import { logStep } from "./debug";

export interface DelegationStatus {
  isDelegated: boolean;
  fqdn?: string;
}

interface DelegationRpcResult {
  isDelegated: boolean;
  fqdn?: string;
}

export async function getDelegationStatus(
  pubkey: PublicKey
): Promise<DelegationStatus> {
  logStep("delegation", "Checking delegation via Magic Router", {
    account: pubkey.toBase58(),
    router: MAGIC_ROUTER_ENDPOINT,
  });

  const response = await fetch(MAGIC_ROUTER_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getDelegationStatus",
      params: [pubkey.toBase58()],
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Magic Router delegation check failed (${response.status}).`
    );
  }

  const payload = (await response.json()) as {
    error?: { message?: string };
    result?: DelegationRpcResult;
  };

  if (payload.error) {
    logStep("delegation", "Router returned error", { error: payload.error });
    throw new Error(
      payload.error.message ?? "Magic Router delegation check failed."
    );
  }

  const result = payload.result;
  if (!result) {
    throw new Error("Magic Router returned an empty delegation status.");
  }

  const status = {
    isDelegated: result.isDelegated,
    fqdn: result.fqdn,
  };

  logStep("delegation", "Delegation status received", {
    isDelegated: status.isDelegated,
    fqdn: status.fqdn,
  });
  return status;
}

export async function isDelegated(pubkey: PublicKey): Promise<boolean> {
  const status = await getDelegationStatus(pubkey);
  return status.isDelegated;
}

/** True when account exists on L1 and is owned by PropAMM (not delegated to ER). */
export async function isPropAmmAccountOnL1(
  connection: Connection,
  pubkey: PublicKey
): Promise<boolean> {
  const info = await connection.getAccountInfo(pubkey);
  if (!info) return false;
  return info.owner.equals(PROGRAM_ID);
}

/** True when user bank exists on L1 and is owned by PropAMM (not delegated to ER). */
export async function isUserBankOnL1(
  connection: Connection,
  userBank: PublicKey
): Promise<boolean> {
  return isPropAmmAccountOnL1(connection, userBank);
}

/** True when L1 account exists but is not yet owned by PropAMM (delegation stub). */
export async function isAccountDelegatedOnL1(
  connection: Connection,
  pubkey: PublicKey
): Promise<boolean> {
  const info = await connection.getAccountInfo(pubkey);
  if (!info) return false;
  return !info.owner.equals(PROGRAM_ID);
}

export async function waitForPropAmmAccountOnL1(
  connection: Connection,
  pubkey: PublicKey,
  timeoutMs = 20_000,
  intervalMs = 500
): Promise<void> {
  logStep("delegation", "Waiting for PropAMM account on L1", {
    account: pubkey.toBase58(),
    timeoutMs,
  });
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isPropAmmAccountOnL1(connection, pubkey)) {
      logStep("delegation", "Account is now on L1 under PropAMM", {
        account: pubkey.toBase58(),
        elapsedMs: Date.now() - start,
      });
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error("Timed out waiting for account to return to L1.");
}

export function isWalletTransactionCancelled(error: unknown): boolean {
  if (!error) return false;

  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: number }).code;
    if (code === 4001) return true;
  }

  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";

  const lower = message.toLowerCase();
  return (
    lower.includes("user rejected") ||
    lower.includes("user declined") ||
    lower.includes("rejected the request") ||
    lower.includes("transaction cancelled") ||
    lower.includes("approval denied") ||
    lower.includes("request rejected")
  );
}

export function requireErEndpoint(status: DelegationStatus): string {
  if (!status.isDelegated) {
    logStep("delegation", "Account is not delegated", {
      isDelegated: status.isDelegated,
    });
    throw new Error("Account is not delegated to an Ephemeral Rollup.");
  }
  logStep("delegation", "Using devnet-eu ER endpoint", { endpoint: ER_ENDPOINT });
  return ER_ENDPOINT; 
}

export async function waitForUndelegated(
  pubkey: PublicKey,
  timeoutMs = 15_000,
  intervalMs = 500
): Promise<void> {
  logStep("delegation", "Waiting for account to undelegate", {
    account: pubkey.toBase58(),
    timeoutMs,
  });
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (!(await isDelegated(pubkey))) {
      logStep("delegation", "Account is now undelegated on L1", {
        account: pubkey.toBase58(),
        elapsedMs: Date.now() - start,
      });
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error("Timed out waiting for account to return to L1.");
}

export const erValidatorRemainingAccounts = () => [
  { pubkey: ER_VALIDATOR, isSigner: false, isWritable: false },
];
