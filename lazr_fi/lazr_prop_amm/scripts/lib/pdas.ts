import { PublicKey } from "@solana/web3.js";

const ADMIN_SEED = "admin";
const POOL_SEED = "pool";
const CONFIG_SEED = "config";
const QUOTE_STATE_SEED = "quote_state";
const RISK_STATE_SEED = "risk_state";
const VOLATILITY_STATE_SEED = "volatility_state";
const HEDGE_STATE_SEED = "hedge_state";
const ASSET_VAULT_SEED = "asset_vault";
const USDC_VAULT_SEED = "usdc_vault";

export interface PoolAccounts {
  pool: PublicKey;
  config: PublicKey;
  quoteState: PublicKey;
  riskState: PublicKey;
  volatilityState: PublicKey;
  hedgeState: PublicKey;
  assetVault: PublicKey;
  usdcVault: PublicKey;
}

export function adminStatePda(programId: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from(ADMIN_SEED)],
    programId
  );
  return pda;
}

export function derivePoolAccounts(
  programId: PublicKey,
  assetMint: PublicKey,
  usdcMint: PublicKey
): PoolAccounts {
  const [pool] = PublicKey.findProgramAddressSync(
    [Buffer.from(POOL_SEED), assetMint.toBuffer(), usdcMint.toBuffer()],
    programId
  );
  const [config] = PublicKey.findProgramAddressSync(
    [Buffer.from(CONFIG_SEED), pool.toBuffer()],
    programId
  );
  const [quoteState] = PublicKey.findProgramAddressSync(
    [Buffer.from(QUOTE_STATE_SEED), pool.toBuffer()],
    programId
  );
  const [riskState] = PublicKey.findProgramAddressSync(
    [Buffer.from(RISK_STATE_SEED), pool.toBuffer()],
    programId
  );
  const [volatilityState] = PublicKey.findProgramAddressSync(
    [Buffer.from(VOLATILITY_STATE_SEED), pool.toBuffer()],
    programId
  );
  const [hedgeState] = PublicKey.findProgramAddressSync(
    [Buffer.from(HEDGE_STATE_SEED), pool.toBuffer()],
    programId
  );
  const [assetVault] = PublicKey.findProgramAddressSync(
    [Buffer.from(ASSET_VAULT_SEED), pool.toBuffer()],
    programId
  );
  const [usdcVault] = PublicKey.findProgramAddressSync(
    [Buffer.from(USDC_VAULT_SEED), pool.toBuffer()],
    programId
  );

  return {
    pool,
    config,
    quoteState,
    riskState,
    volatilityState,
    hedgeState,
    assetVault,
    usdcVault,
  };
}
