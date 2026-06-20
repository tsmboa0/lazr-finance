/**
 * Devnet pool bootstrap for Lazr Prop AMM.
 *
 * Creates ETH / SOL / PEPE / BONK mints (BTC + USDC loaded from tests/test-mints.json),
 * initializes pools, seeds vault liquidity, delegates each pool to ER, and schedules cranks.
 *
 * Writes a manifest consumed by the frontend faucet:
 *   - scripts/devnet-tokens.json
 *   - ../lazr_fi_app/app/data/devnet-tokens.json
 *
 * Run (review first, then execute):
 *   cd lazr_fi/lazr_prop_amm
 *   anchor run init-devnet-pools
 *
 * Or directly:
 *   ANCHOR_PROVIDER_URL=... ANCHOR_WALLET=~/.config/solana/id.json npx tsx scripts/init-devnet-pools.ts
 */

import * as anchor from "@anchor-lang/core";
import { BN, Program } from "@anchor-lang/core";
import { LazrPropAmm } from "../target/types/lazr_prop_amm";
import {
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  Transaction,
} from "@solana/web3.js";
import {
  DELEGATION_PROGRAM_ID,
  MAGIC_PROGRAM_ID,
} from "@magicblock-labs/ephemeral-rollups-sdk";
import { createMint, getAccount, getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";

import { adminStatePda, derivePoolAccounts } from "./lib/pdas";
import { createErProvider, sendErTransaction } from "./lib/er-tx";
import {
  CRANK_ITERATIONS,
  DEFAULT_LIQUIDITY,
  DEFAULT_POOL_PARAMS,
  ER_ENDPOINT,
  ER_VALIDATOR,
  PYTH_LAZER_PROGRAM,
  SUPPORTED_TOKENS,
  TokenDefinition,
  oracleFeedForToken,
} from "./lib/token-defs";

// ─── Paths ───────────────────────────────────────────────────────────────────

const ROOT = process.cwd();
const TEST_MINTS_PATH = path.join(ROOT, "tests", "test-mints.json");
const MANIFEST_PATH = path.join(ROOT, "scripts", "devnet-tokens.json");
const FRONTEND_MANIFEST_PATH = path.join(
  ROOT,
  "..",
  "lazr_fi_app",
  "app",
  "data",
  "devnet-tokens.json"
);

// ─── Manifest types ──────────────────────────────────────────────────────────

interface SavedTestMints {
  assetMint: string;
  usdcMint: string;
}

interface DevnetTokenEntry {
  symbol: string;
  name: string;
  assetMint: string;
  decimals: number;
  pythLazerId: number;
  oracleExponent: number;
  oracleFeed: string;
  pool: string;
  config: string;
  quoteState: string;
  riskState: string;
  volatilityState: string;
  hedgeState: string;
  assetVault: string;
  usdcVault: string;
  delegated: boolean;
  crankTaskId: number;
}

interface DevnetTokenManifest {
  version: 1;
  network: "devnet";
  programId: string;
  usdcMint: string;
  usdcDecimals: number;
  mintAuthority: string;
  erEndpoint: string;
  erValidator: string;
  faucetClaimAmount: number;
  tokens: DevnetTokenEntry[];
  updatedAt: string;
}

interface ExistingManifest {
  tokens?: Array<{ symbol: string; assetMint: string }>;
}

// ─── Logging ─────────────────────────────────────────────────────────────────

function log(msg: string) {
  console.log(msg);
}

function logStep(msg: string) {
  console.log(`\n  ▸ ${msg}`);
}

function logTx(label: string, sig: string) {
  console.log(`    ✓ ${label}`);
  console.log(`      tx: ${sig.slice(0, 20)}...${sig.slice(-8)}`);
}

function logSkip(reason: string) {
  console.log(`    ↷ skip: ${reason}`);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function loadTestMints(): SavedTestMints {
  if (!existsSync(TEST_MINTS_PATH)) {
    throw new Error(
      `Missing ${TEST_MINTS_PATH}. Run anchor test once to create BTC + USDC mints.`
    );
  }
  return JSON.parse(readFileSync(TEST_MINTS_PATH, "utf8")) as SavedTestMints;
}

function loadExistingManifest(): ExistingManifest | null {
  if (!existsSync(MANIFEST_PATH)) {
    return null;
  }
  return JSON.parse(readFileSync(MANIFEST_PATH, "utf8")) as ExistingManifest;
}

async function accountExists(
  connection: anchor.web3.Connection,
  pubkey: PublicKey
): Promise<boolean> {
  const info = await connection.getAccountInfo(pubkey);
  return info !== null;
}

async function isDelegated(
  connection: anchor.web3.Connection,
  pubkey: PublicKey
): Promise<boolean> {
  const info = await connection.getAccountInfo(pubkey);
  return !!info && info.owner.equals(DELEGATION_PROGRAM_ID);
}

function resolveAssetMint(
  token: TokenDefinition,
  testMints: SavedTestMints,
  existingManifest: ExistingManifest | null
): PublicKey | null {
  if (token.useExistingBtcMint) {
    return new PublicKey(testMints.assetMint);
  }

  const saved = existingManifest?.tokens?.find((t) => t.symbol === token.symbol);
  return saved ? new PublicKey(saved.assetMint) : null;
}

async function ensureAtaBalance(
  connection: anchor.web3.Connection,
  payer: Keypair,
  mint: PublicKey,
  owner: PublicKey,
  mintAuthority: Keypair,
  target: number
): Promise<PublicKey> {
  const ata = (
    await getOrCreateAssociatedTokenAccount(
      connection,
      payer,
      mint,
      owner
    )
  ).address;

  const account = await getAccount(connection, ata);
  const current = Number(account.amount);
  if (current < target) {
    await mintTo(connection, payer, mint, ata, mintAuthority, target - current);
  }

  return ata;
}

async function assertOracleFeedExists(
  connection: anchor.web3.Connection,
  token: TokenDefinition,
  oracleFeed: PublicKey
): Promise<void> {
  const info = await connection.getAccountInfo(oracleFeed);
  if (!info) {
    throw new Error(
      `Missing Pyth Lazer oracle for ${token.symbol}: feed id ${token.pythLazerId} → ${oracleFeed.toString()}`
    );
  }

  const validOwner =
    info.owner.equals(PYTH_LAZER_PROGRAM) ||
    info.owner.equals(DELEGATION_PROGRAM_ID);

  if (!validOwner) {
    throw new Error(
      `Oracle for ${token.symbol} has unexpected owner ${info.owner.toString()} (expected Pyth Lazer or delegation program)`
    );
  }
}

async function sendBaseTransaction(
  provider: anchor.AnchorProvider,
  payer: Keypair,
  tx: Transaction,
  computeUnits = 400_000
): Promise<string> {
  const budgeted = new Transaction().add(
    ComputeBudgetProgram.setComputeUnitLimit({ units: computeUnits }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 500_000 })
  );
  budgeted.add(...tx.instructions);
  budgeted.feePayer = payer.publicKey;
  budgeted.recentBlockhash = (
    await provider.connection.getLatestBlockhash("confirmed")
  ).blockhash;

  return provider.sendAndConfirm(budgeted, [payer], {
    skipPreflight: true,
    commitment: "confirmed",
  });
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.LazrPropAmm as Program<LazrPropAmm>;
  const authority = (provider.wallet as anchor.Wallet).payer;

  const erProvider = createErProvider(provider);
  const programEr = new Program<LazrPropAmm>(program.idl, erProvider);

  const testMints = loadTestMints();
  const usdcMint = new PublicKey(testMints.usdcMint);
  const existingManifest = loadExistingManifest();

  log("════════════════════════════════════════════════════════════");
  log("  LAZR PROP AMM — DEVNET POOL BOOTSTRAP");
  log("════════════════════════════════════════════════════════════");
  log(`  Program:   ${program.programId.toString()}`);
  log(`  Authority: ${authority.publicKey.toString()}`);
  log(`  USDC:      ${usdcMint.toString()}`);
  log(`  ER:        ${ER_ENDPOINT}`);
  log(`  Pyth:      ${PYTH_LAZER_PROGRAM.toString()}`);

  logStep("Oracle feeds (one unique PDA per token)");
  for (const token of SUPPORTED_TOKENS) {
    const feed = oracleFeedForToken(token);
    log(
      `    ${token.symbol.padEnd(5)} feedId=${String(token.pythLazerId).padEnd(2)} exp=${token.oracleExponent}  ${feed.toString()}`
    );
  }

  // ── 1. Ensure admin state ──────────────────────────────────────────────────

  logStep("Ensuring admin state");
  const adminPda = adminStatePda(program.programId);
  if (!(await accountExists(provider.connection, adminPda))) {
    const sig = await program.methods
      .initializeAdmin()
      .accountsPartial({ authority: authority.publicKey })
      .rpc();
    logTx("initializeAdmin", sig);
  } else {
    logSkip("admin state already initialized");
  }

  // ── 2. Admin USDC ATA (shared across pools) ────────────────────────────────

  const authorityUsdcAta = (
    await getOrCreateAssociatedTokenAccount(
      provider.connection,
      authority,
      usdcMint,
      authority.publicKey
    )
  ).address;

  const manifestTokens: DevnetTokenEntry[] = [];

  // ── 3. Per-token setup ─────────────────────────────────────────────────────

  for (const token of SUPPORTED_TOKENS) {
    logStep(`Processing ${token.symbol}`);

    let assetMint = resolveAssetMint(token, testMints, existingManifest);

    if (assetMint) {
      const live = await accountExists(provider.connection, assetMint);
      if (!live) {
        log(`    ! saved mint ${assetMint.toString()} missing on-chain — recreating`);
        assetMint = null;
      } else {
        log(`    mint: ${assetMint.toString()} (existing)`);
      }
    }

    if (!assetMint) {
      assetMint = await createMint(
        provider.connection,
        authority,
        authority.publicKey,
        null,
        token.decimals
      );
      log(`    mint: ${assetMint.toString()} (created)`);
    }

    const oracleFeed = oracleFeedForToken(token);
    const accounts = derivePoolAccounts(
      program.programId,
      assetMint,
      usdcMint
    );

    log(`    pool:        ${accounts.pool.toString()}`);
    log(
      `    oracle feed: ${oracleFeed.toString()} (pyth-lazer id ${token.pythLazerId}, exp ${token.oracleExponent})`
    );
    await assertOracleFeedExists(provider.connection, token, oracleFeed);

    // 3a. Initialize pool
    if (!(await accountExists(provider.connection, accounts.pool))) {
      const sig = await program.methods
        .initializePool({
          pythLazerId: token.pythLazerId,
          oracleExponent: token.oracleExponent,
          targetInventoryBps: new BN(DEFAULT_POOL_PARAMS.targetInventoryBps),
          baseSpreadBps: new BN(DEFAULT_POOL_PARAMS.baseSpreadBps),
          maxSpreadBps: new BN(DEFAULT_POOL_PARAMS.maxSpreadBps),
          virtualDepthK: new BN(DEFAULT_POOL_PARAMS.virtualDepthK),
          volatilityWindowSize: DEFAULT_POOL_PARAMS.volatilityWindowSize,
          crankIntervalMs: new BN(DEFAULT_POOL_PARAMS.crankIntervalMs),
          maxTradeSize: new BN(DEFAULT_POOL_PARAMS.maxTradeSize),
          lambda: new BN(DEFAULT_POOL_PARAMS.lambda),
          maxOracleStalenessSec: new BN(
            DEFAULT_POOL_PARAMS.maxOracleStalenessSec
          ),
        })
        .accountsPartial({
          authority: authority.publicKey,
          assetMint,
          usdcMint,
          oracleFeed,
        })
        .rpc();
      logTx("initializePool", sig);
    } else {
      logSkip("pool already initialized");
    }

    // 3b. Seed vault liquidity (must happen on L1 before delegation)
    const poolDelegated = await isDelegated(provider.connection, accounts.pool);
    if (!poolDelegated) {
      let vaultNeedsLiquidity = true;
      try {
        const assetVault = await getAccount(
          provider.connection,
          accounts.assetVault
        );
        vaultNeedsLiquidity =
          Number(assetVault.amount) < DEFAULT_LIQUIDITY.assetAmount / 2;
      } catch {
        vaultNeedsLiquidity = true;
      }

      if (vaultNeedsLiquidity) {
        const authorityAssetAta = await ensureAtaBalance(
          provider.connection,
          authority,
          assetMint,
          authority.publicKey,
          authority,
          DEFAULT_LIQUIDITY.assetAmount * 2
        );
        await ensureAtaBalance(
          provider.connection,
          authority,
          usdcMint,
          authority.publicKey,
          authority,
          DEFAULT_LIQUIDITY.usdcAmount * 2
        );

        const sig = await program.methods
          .addLiquidity({
            assetAmount: new BN(DEFAULT_LIQUIDITY.assetAmount),
            usdcAmount: new BN(DEFAULT_LIQUIDITY.usdcAmount),
          })
          .accountsPartial({
            authority: authority.publicKey,
            pool: accounts.pool,
            authorityAssetAccount: authorityAssetAta,
            authorityUsdcAccount: authorityUsdcAta,
            assetVault: accounts.assetVault,
            usdcVault: accounts.usdcVault,
          })
          .rpc();
        logTx("addLiquidity", sig);
      } else {
        logSkip("vaults already seeded");
      }
    } else {
      logSkip("pool delegated — cannot add L1 liquidity");
    }

    // 3c. Delegate pool + sub-accounts to ER
    let delegated = await isDelegated(provider.connection, accounts.pool);
    if (!delegated) {
      const delegateTx = await program.methods
        .delegatePool()
        .accountsPartial({
          payer: authority.publicKey,
          assetMint,
          usdcMint,
        })
        .remainingAccounts([
          { pubkey: ER_VALIDATOR, isSigner: false, isWritable: false },
        ])
        .transaction();

      const sig = await sendBaseTransaction(
        provider,
        authority,
        delegateTx,
        600_000
      );
      logTx("delegatePool", sig);
      delegated = true;
    } else {
      logSkip("pool already delegated");
    }

    // 3d. Schedule crank on ER (unique task id per pyth feed)
    const crankTaskId = token.pythLazerId;
    try {
      const crankTx = await programEr.methods
        .setupCrank({
          taskId: new BN(crankTaskId),
          iterations: new BN(CRANK_ITERATIONS),
        })
        .accountsPartial({
          payer: authority.publicKey,
          pool: accounts.pool,
          config: accounts.config,
          quoteState: accounts.quoteState,
          riskState: accounts.riskState,
          volatilityState: accounts.volatilityState,
          hedgeState: accounts.hedgeState,
          magicProgram: MAGIC_PROGRAM_ID,
          oracleFeed,
          program: program.programId,
        })
        .transaction();

      const sig = await sendErTransaction(erProvider, crankTx);
      logTx("setupCrank", sig);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : String(err ?? "unknown error");
      if (
        msg.toLowerCase().includes("already") ||
        msg.toLowerCase().includes("task")
      ) {
        logSkip(`crank may already exist (${msg.slice(0, 72)})`);
      } else {
        throw err;
      }
    }

    // manifestTokens.push({
    //   symbol: token.symbol,
    //   name: token.name,
    //   assetMint: assetMint.toString(),
    //   decimals: token.decimals,
    //   pythLazerId: token.pythLazerId,
    //   oracleExponent: token.oracleExponent,
    //   oracleFeed: oracleFeed.toString(),
    //   pool: accounts.pool.toString(),
    //   config: accounts.config.toString(),
    //   quoteState: accounts.quoteState.toString(),
    //   riskState: accounts.riskState.toString(),
    //   volatilityState: accounts.volatilityState.toString(),
    //   hedgeState: accounts.hedgeState.toString(),
    //   assetVault: accounts.assetVault.toString(),
    //   usdcVault: accounts.usdcVault.toString(),
    //   delegated,
    //   crankTaskId,
    // });
  }

  // ── 4. Write manifest ──────────────────────────────────────────────────────

  // const manifest: DevnetTokenManifest = {
  //   version: 1,
  //   network: "devnet",
  //   programId: program.programId.toString(),
  //   usdcMint: usdcMint.toString(),
  //   usdcDecimals: 6,
  //   mintAuthority: authority.publicKey.toString(),
  //   erEndpoint: ER_ENDPOINT,
  //   erValidator: ER_VALIDATOR.toString(),
  //   faucetClaimAmount: 1_000,
  //   tokens: manifestTokens,
  //   updatedAt: new Date().toISOString(),
  // };

  // writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
  // logStep(`Wrote manifest → ${MANIFEST_PATH}`);

  // const frontendDir = path.dirname(FRONTEND_MANIFEST_PATH);
  // mkdirSync(frontendDir, { recursive: true });
  // writeFileSync(FRONTEND_MANIFEST_PATH, JSON.stringify(manifest, null, 2));
  // log(`           → ${FRONTEND_MANIFEST_PATH}`);

  log("\n════════════════════════════════════════════════════════════");
  log("  BOOTSTRAP COMPLETE");
  log("════════════════════════════════════════════════════════════");
  for (const t of manifestTokens) {
    log(
      `  ${t.symbol.padEnd(5)} mint=${t.assetMint}  oracle=${t.oracleFeed}  pool=${t.pool}`
    );
  }
  log("");
}

main().catch((err) => {
  console.error("\n✗ Bootstrap failed:", err);
  process.exit(1);
});
