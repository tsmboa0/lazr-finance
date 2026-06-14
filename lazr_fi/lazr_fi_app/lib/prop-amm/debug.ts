import { Transaction } from "@solana/web3.js";

const PREFIX = "[Lazr PropAMM]";

export type PropAmmFlow = "deposit" | "withdraw" | "swap" | "quote" | "delegation" | "tx";

export function logStep(
  flow: PropAmmFlow,
  step: string,
  data?: Record<string, unknown>
): void {
  if (data !== undefined) {
    console.log(`${PREFIX} [${flow}] ${step}`, data);
  } else {
    console.log(`${PREFIX} [${flow}] ${step}`);
  }
}

export function logTxInstructions(label: string, tx: Transaction): void {
  logStep("tx", label, {
    instructionCount: tx.instructions.length,
    instructions: tx.instructions.map((ix, index) => ({
      index,
      programId: ix.programId.toBase58(),
      keyCount: ix.keys.length,
      dataLength: ix.data.length,
    })),
  });
}

export function logError(
  flow: PropAmmFlow,
  step: string,
  error: unknown
): void {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error && "message" in error
        ? String((error as { message: unknown }).message)
        : String(error);
  console.error(`${PREFIX} [${flow}] FAILED at ${step}:`, message, error);
}
