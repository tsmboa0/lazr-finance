/**
 * Keep pool quote cranks alive on ER.
 *
 * Modes:
 *   --setup   Schedule infinite on-chain cranks (iterations=0) for every pool.
 *   (default) Fire processCrankTick for all pools in a tight loop (keeper).
 *
 * Run:
 *   cd lazr_fi/lazr_prop_amm
 *   npx tsx scripts/run-pool-cranks.ts
 *   npx tsx scripts/run-pool-cranks.ts --setup
 */

import * as anchor from "@anchor-lang/core";
import { BN, Program } from "@anchor-lang/core";
import { LazrPropAmm } from "../target/types/lazr_prop_amm";
import { ComputeBudgetProgram, PublicKey, Transaction } from "@solana/web3.js";
import { MAGIC_PROGRAM_ID } from "@magicblock-labs/ephemeral-rollups-sdk";
import { readFileSync } from "fs";
import path from "path";

import { createErProvider, sendErTransaction } from "./lib/er-tx";
import {
  CRANK_ITERATIONS,
  DEFAULT_POOL_PARAMS,
  ER_ENDPOINT,
} from "./lib/token-defs";

const MANIFEST_PATH = path.join(process.cwd(), "scripts", "devnet-tokens.json");

interface ManifestToken {
  symbol: string;
  pool: string;
  config: string;
  quoteState: string;
  riskState: string;
  volatilityState: string;
  hedgeState: string;
  assetVault: string;
  usdcVault: string;
  oracleFeed: string;
  crankTaskId: number;
  pythLazerId: number;
}

interface Manifest {
  programId: string;
  tokens: ManifestToken[];
}

function log(msg: string) {
  console.log(msg);
}

function loadManifest(): Manifest {
  return JSON.parse(readFileSync(MANIFEST_PATH, "utf8")) as Manifest;
}

async function setupCranks(
  programEr: Program<LazrPropAmm>,
  erProvider: anchor.AnchorProvider,
  tokens: ManifestToken[]
) {
  for (const token of tokens) {
    const oracleFeed = new PublicKey(token.oracleFeed);
    const taskId = token.crankTaskId ?? token.pythLazerId;

    try {
      const tx = await programEr.methods
        .setupCrank({
          taskId: new BN(taskId),
          iterations: new BN(CRANK_ITERATIONS),
        })
        .accountsPartial({
          payer: erProvider.wallet.publicKey,
          pool: new PublicKey(token.pool),
          config: new PublicKey(token.config),
          quoteState: new PublicKey(token.quoteState),
          riskState: new PublicKey(token.riskState),
          volatilityState: new PublicKey(token.volatilityState),
          hedgeState: new PublicKey(token.hedgeState),
          magicProgram: MAGIC_PROGRAM_ID,
          oracleFeed,
          program: programEr.programId,
        })
        .transaction();

      const sig = await sendErTransaction(erProvider, tx);
      log(`✓ ${token.symbol} setupCrank (infinite) → ${sig}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (
        msg.toLowerCase().includes("already") ||
        msg.toLowerCase().includes("task")
      ) {
        log(`· ${token.symbol} crank already scheduled (${msg.slice(0, 72)})`);
      } else {
        throw err;
      }
    }
  }
}

async function fireCrankTick(
  programEr: Program<LazrPropAmm>,
  erProvider: anchor.AnchorProvider,
  token: ManifestToken
): Promise<string> {
  const tx = new Transaction().add(
    ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 500_000 }),
    await programEr.methods
      .processCrankTick()
      .accountsPartial({
        pool: new PublicKey(token.pool),
        config: new PublicKey(token.config),
        quoteState: new PublicKey(token.quoteState),
        riskState: new PublicKey(token.riskState),
        volatilityState: new PublicKey(token.volatilityState),
        hedgeState: new PublicKey(token.hedgeState),
        oracleFeed: new PublicKey(token.oracleFeed),
        assetVault: new PublicKey(token.assetVault),
        usdcVault: new PublicKey(token.usdcVault),
      })
      .instruction()
  );

  return sendErTransaction(erProvider, tx);
}

async function runKeeper(
  programEr: Program<LazrPropAmm>,
  erProvider: anchor.AnchorProvider,
  tokens: ManifestToken[]
) {
  const intervalMs = DEFAULT_POOL_PARAMS.crankIntervalMs;
  log(
    `Keeper running on ${ER_ENDPOINT} — ${tokens.length} pools every ${intervalMs}ms (Ctrl+C to stop)`
  );

  let round = 0;
  while (true) {
    round += 1;
    const started = Date.now();

    for (const token of tokens) {
      try {
        const sig = await fireCrankTick(programEr, erProvider, token);
        log(`[${round}] ${token.symbol} tick → ${sig.slice(0, 16)}…`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        log(`[${round}] ${token.symbol} tick FAILED: ${msg.slice(0, 120)}`);
      }
    }

    const elapsed = Date.now() - started;
    const wait = Math.max(0, intervalMs - elapsed);
    if (wait > 0) {
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
  }
}

async function main() {
  const setupOnly = process.argv.includes("--setup");
  const manifest = loadManifest();
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.LazrPropAmm as Program<LazrPropAmm>;
  const erProvider = createErProvider(provider);
  const programEr = new Program<LazrPropAmm>(program.idl, erProvider);

  log(`ER endpoint: ${ER_ENDPOINT}`);
  log(`Pools: ${manifest.tokens.map((t) => t.symbol).join(", ")}`);

  if (setupOnly) {
    await setupCranks(programEr, erProvider, manifest.tokens);
    log("Done — infinite cranks scheduled.");
    return;
  }

  await runKeeper(programEr, erProvider, manifest.tokens);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
