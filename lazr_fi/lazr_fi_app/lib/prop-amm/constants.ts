import { PublicKey } from "@solana/web3.js";
import { getDevnetManifest } from "../devnet-config";

const manifest = getDevnetManifest();

export const PROGRAM_ID = new PublicKey(manifest.programId);
export const USDC_MINT = new PublicKey(manifest.usdcMint);
/** Delegation status API only — do not send ER transactions here. */
export const MAGIC_ROUTER_ENDPOINT = "https://devnet-router.magicblock.app";
/** Fast ER RPC for all delegated reads and writes. */
export const ER_ENDPOINT = "https://devnet-eu.magicblock.app/";
export const ER_WS_ENDPOINT = "wss://devnet-eu.magicblock.app/";
export const ER_VALIDATOR = new PublicKey(manifest.erValidator);

export const USER_BANK_SEED = "user_bank";
export const SESSION_TOKEN_SEED = "session_token_v2";
export const SESSION_VALIDITY_SEC = 60 * 60 * 24;
/** L1 transfer to session signer on first createSession (MagicBlock requirement). */
export const SESSION_SIGNER_FUND_LAMPORTS = 10_000_000;
/** ER top-up passed into createSessionV2. */
export const SESSION_TOP_UP_LAMPORTS = 10_000_000;
