import { PublicKey } from "@solana/web3.js";
import { AUTOPILOT_SEED, PROGRAM_ID, USER_BANK_SEED } from "./constants";

export function userBankPda(authority: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from(USER_BANK_SEED), authority.toBuffer()],
    PROGRAM_ID
  );
  return pda;
}

export function autopilotPda(pool: PublicKey, authority: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from(AUTOPILOT_SEED), pool.toBuffer(), authority.toBuffer()],
    PROGRAM_ID
  );
  return pda;
}

/** MagicBlock scheduled-task id base for autopilot cranks. */
export const AUTOPILOT_CRANK_TASK_ID_BASE = 10_000;

/** Next crank task id: 10000 on first run, +1 on every restart. */
export function nextAutopilotCrankTaskId(
  existing: bigint | null | undefined
): number {
  if (existing == null) return AUTOPILOT_CRANK_TASK_ID_BASE;
  const prev = Number(existing);
  if (prev < AUTOPILOT_CRANK_TASK_ID_BASE) return AUTOPILOT_CRANK_TASK_ID_BASE;
  return prev + 1;
}
