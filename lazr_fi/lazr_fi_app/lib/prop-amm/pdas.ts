import { PublicKey } from "@solana/web3.js";
import { PROGRAM_ID, USER_BANK_SEED } from "./constants";

export function userBankPda(authority: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from(USER_BANK_SEED), authority.toBuffer()],
    PROGRAM_ID
  );
  return pda;
}
