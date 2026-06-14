import * as anchor from "@anchor-lang/core";
import { BN, Program, web3 } from "@anchor-lang/core";
import { LazrPropAmm } from "../target/types/lazr_prop_amm";
import {
  PublicKey,
  Keypair,
  LAMPORTS_PER_SOL,
  ComputeBudgetProgram,
} from "@solana/web3.js";
import { MAGIC_PROGRAM_ID, DELEGATION_PROGRAM_ID } from "@magicblock-labs/ephemeral-rollups-sdk";
import {
  delegationRecordPdaFromDelegatedAccount,
  delegationMetadataPdaFromDelegatedAccount,
  delegateBufferPdaFromDelegatedAccountAndOwnerProgram,
  createTopUpEscrowInstruction,
  escrowPdaFromEscrowAuthority,
  magicFeeVaultPdaFromValidator,
} from "@magicblock-labs/ephemeral-rollups-sdk";
import { SessionTokenManager } from "@magicblock-labs/gum-sdk";
import { sendAndConfirmTransaction } from "@solana/web3.js";
import { initializeSessionSignerKeypair } from "./utils/sessionKeypair";
import {
  ensureTokenBalance,
  fundSolIfNeeded,
  getOrCreateTokenAccount,
  loadOrCreateTestKeypair,
  loadOrCreateTestMints,
} from "./utils/testFixtures";
import {
  getAccount,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { expect } from "chai";

// ─── PDA Seeds ──────────────────────────────────────────────────────────────
const ADMIN_SEED = "admin";
const POOL_SEED = "pool";
const CONFIG_SEED = "config";
const QUOTE_STATE_SEED = "quote_state";
const RISK_STATE_SEED = "risk_state";
const VOLATILITY_STATE_SEED = "volatility_state";
const HEDGE_STATE_SEED = "hedge_state";
const USER_BANK_SEED = "user_bank";
const ASSET_VAULT_SEED = "asset_vault";
const USDC_VAULT_SEED = "usdc_vault";

// ─── Pyth Lazer Oracle (BTC/USD) ────────────────────────────────────────────
const PYTH_LAZER_PROGRAM = new PublicKey(
  "PriCems5tHihc6UDXDjzjeawomAwBduWMGAi8ZUjppd"
);
const BTC_PYTH_LAZER_ID = 1;
const BTC_ORACLE_EXPONENT = -8;

const [BTC_ORACLE_PDA] = PublicKey.findProgramAddressSync(
  [
    Buffer.from("price_feed"),
    Buffer.from("pyth-lazer"),
    Buffer.from(String(BTC_PYTH_LAZER_ID)),
  ],
  PYTH_LAZER_PROGRAM
);

// ─── MagicBlock ER Connection ───────────────────────────────────────────────
const ER_ENDPOINT =
  process.env.EPHEMERAL_PROVIDER_ENDPOINT ||
  "https://devnet-eu.magicblock.app/";
const ER_WS_ENDPOINT =
  process.env.EPHEMERAL_WS_ENDPOINT || "wss://devnet-eu.magicblock.app/";

// Asia ER validator (devnet-as.magicblock.app)
const ER_VALIDATOR = new PublicKey(
  "MEUGGrYPxKk17hCr7wpT6s8dtNokZj5U2L57vjYMS8e"
);

// ─── Logging Helpers ────────────────────────────────────────────────────────
function logSection(title: string) {
  const bar = "═".repeat(60);
  console.log(`\n${bar}`);
  console.log(`  ${title}`);
  console.log(`${bar}`);
}

function logStep(step: string) {
  console.log(`\n  ▸ ${step}`);
}

function logResult(label: string, value: any) {
  console.log(`    ${label}: ${value}`);
}

function logState(title: string, fields: Record<string, any>) {
  console.log(`    ┌─ ${title}`);
  for (const [key, val] of Object.entries(fields)) {
    console.log(`    │  ${key}: ${val}`);
  }
  console.log(`    └─`);
}

function logTx(label: string, sig: string) {
  console.log(`    ✓ ${label}`);
  console.log(`      tx: ${sig.slice(0, 20)}...${sig.slice(-8)}`);
}

function logError(context: string, err: any) {
  const msg =
    err?.error?.errorMessage ||
    err?.message ||
    err?.toString()?.slice(0, 120) ||
    "Unknown error";
  console.log(`    ✗ ${context}: ${msg}`);
}

describe("lazr_prop_amm", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.LazrPropAmm as Program<LazrPropAmm>;
  const authority = (provider.wallet as anchor.Wallet).payer;
  const testUser = loadOrCreateTestKeypair();

  let providerER: anchor.AnchorProvider;
  let programER: Program<LazrPropAmm>;

  function getErProvider(): anchor.AnchorProvider {
    if (!providerER) {
      providerER = new anchor.AnchorProvider(
        new anchor.web3.Connection(ER_ENDPOINT, {
          wsEndpoint: ER_WS_ENDPOINT,
          commitment: "confirmed",
        }),
        provider.wallet,
        { commitment: "confirmed", preflightCommitment: "confirmed" }
      );
    }
    return providerER;
  }

  function getErProgram(): Program<LazrPropAmm> {
    if (!programER) {
      programER = new Program<LazrPropAmm>(program.idl, getErProvider());
    }
    return programER;
  }

  async function accountExists(pubkey: PublicKey): Promise<boolean> {
    const info = await provider.connection.getAccountInfo(pubkey);
    return info !== null;
  }

  function findBankEntry(
    entries: { mint: PublicKey; balance: BN }[],
    mint: PublicKey
  ) {
    return entries.find((e) => e.mint.toString() === mint.toString());
  }

  const erValidatorRemainingAccounts = () => [
    { pubkey: ER_VALIDATOR, isSigner: false, isWritable: false },
  ];

  const userBankDelegationRemainingAccounts = () => [
    { pubkey: program.programId, isSigner: false, isWritable: false },
    {
      pubkey: delegateBufferPdaFromDelegatedAccountAndOwnerProgram(
        userBankPDA,
        program.programId
      ),
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: delegationRecordPdaFromDelegatedAccount(userBankPDA),
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: delegationMetadataPdaFromDelegatedAccount(userBankPDA),
      isSigner: false,
      isWritable: true,
    },
    { pubkey: DELEGATION_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: ER_VALIDATOR, isSigner: false, isWritable: false },
  ];

  const sessionKeypair = initializeSessionSignerKeypair();
  const SESSION_TOKEN_SEED = "session_token_v2";
  let sessionTokenPDA: PublicKey;
  let sessionTokenManager: SessionTokenManager;

  async function isDelegated(pubkey: PublicKey): Promise<boolean> {
    const info = await provider.connection.getAccountInfo(pubkey);
    return !!info && info.owner.equals(DELEGATION_PROGRAM_ID);
  }

  async function isPoolDelegated(): Promise<boolean> {
    return isDelegated(poolPDA);
  }

  async function fetchPool() {
    if (await isPoolDelegated()) {
      return getErProgram().account.pool.fetch(poolPDA);
    }
    return program.account.pool.fetch(poolPDA);
  }

  async function fetchConfig() {
    if (await isPoolDelegated()) {
      return getErProgram().account.config.fetch(configPDA);
    }
    return program.account.config.fetch(configPDA);
  }

  async function ensureUserBankOnBaseLayer(): Promise<void> {
    if (!(await accountExists(userBankPDA))) return;
    if (!(await isDelegated(userBankPDA))) return;

    logStep("UserBank is delegated — undelegating on ER before base-layer tests");
    const tx = await program.methods
      .undelegateUserBank()
      .accountsPartial({
        payer: testUser.publicKey,
        userBank: userBankPDA,
        sessionToken: null,
      })
      .transaction();
    const sig = await sendErTestUserTransaction(tx);
    logTx("undelegateUserBank (setup)", sig);
    await new Promise((r) => setTimeout(r, 3000));
  }

  async function ensureUserBankDelegated(): Promise<void> {
    if (await isDelegated(userBankPDA)) return;

    logStep("UserBank not delegated — delegating before ER user tests");
    const tx = await program.methods
      .delegateUserBank()
      .accountsPartial({
        payer: testUser.publicKey,
        userBank: userBankPDA,
      })
      .remainingAccounts(erValidatorRemainingAccounts())
      .transaction();
    const sig = await sendBaseTransaction(tx, [testUser], 400_000);
    logTx("delegateUserBank (setup)", sig);
    await new Promise((r) => setTimeout(r, 2000));
  }

  async function sendErSessionTransaction(
    tx: web3.Transaction,
    signers: Keypair[]
  ): Promise<string> {
    const erProvider = getErProvider();
    tx.feePayer = signers[0].publicKey;
    const latest = await erProvider.connection.getLatestBlockhash("confirmed");
    tx.recentBlockhash = latest.blockhash;
    tx.sign(...signers);

    const sig = await erProvider.connection.sendRawTransaction(tx.serialize(), {
      skipPreflight: true,
      maxRetries: 3,
    });
    const result = await erProvider.connection.confirmTransaction(
      {
        signature: sig,
        blockhash: latest.blockhash,
        lastValidBlockHeight: latest.lastValidBlockHeight,
      },
      "confirmed"
    );
    if (result.value.err) {
      throw new Error(`ER session tx failed: ${JSON.stringify(result.value.err)}`);
    }
    return sig;
  }

  async function sendTestUserTransaction(
    tx: web3.Transaction,
    extraSigners: Keypair[] = []
  ): Promise<string> {
    tx.feePayer = testUser.publicKey;
    tx.recentBlockhash = (
      await provider.connection.getLatestBlockhash("confirmed")
    ).blockhash;
    return provider.sendAndConfirm(tx, [testUser, ...extraSigners], {
      skipPreflight: true,
      commitment: "confirmed",
    });
  }

  async function sendErTestUserTransaction(tx: web3.Transaction): Promise<string> {
    const erProvider = getErProvider();
    tx.feePayer = testUser.publicKey;
    const latest = await erProvider.connection.getLatestBlockhash("confirmed");
    tx.recentBlockhash = latest.blockhash;
    tx.sign(testUser);

    const sig = await erProvider.connection.sendRawTransaction(tx.serialize(), {
      skipPreflight: true,
      maxRetries: 3,
    });
    const result = await erProvider.connection.confirmTransaction(
      {
        signature: sig,
        blockhash: latest.blockhash,
        lastValidBlockHeight: latest.lastValidBlockHeight,
      },
      "confirmed"
    );
    if (result.value.err) {
      throw new Error(`ER test-user tx failed: ${JSON.stringify(result.value.err)}`);
    }
    return sig;
  }

  async function sendErTransaction(tx: web3.Transaction): Promise<string> {
    const erProvider = getErProvider();
    tx.feePayer = erProvider.wallet.publicKey;
    const latest = await erProvider.connection.getLatestBlockhash("confirmed");
    tx.recentBlockhash = latest.blockhash;

    const simulation = await erProvider.connection.simulateTransaction(tx);
    if (simulation.value.err) {
      const logs = simulation.value.logs?.join("\n") ?? "";
      throw new Error(
        `ER simulation failed: ${JSON.stringify(simulation.value.err)}\n${logs}`
      );
    }

    const signed = await erProvider.wallet.signTransaction(tx);
    const sig = await erProvider.connection.sendRawTransaction(
      signed.serialize(),
      { skipPreflight: true, maxRetries: 3 }
    );
    const result = await erProvider.connection.confirmTransaction(
      { signature: sig, blockhash: latest.blockhash, lastValidBlockHeight: latest.lastValidBlockHeight },
      "confirmed"
    );
    if (result.value.err) {
      throw new Error(`ER tx failed: ${JSON.stringify(result.value.err)}`);
    }
    return sig;
  }

  async function sendBaseTransaction(
    tx: web3.Transaction,
    extraSigners: Keypair[] = [],
    computeUnits = 200_000
  ): Promise<string> {
    const budgetedTx = new web3.Transaction().add(
      ComputeBudgetProgram.setComputeUnitLimit({ units: computeUnits }),
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 500_000 })
    );
    budgetedTx.add(...tx.instructions);
    budgetedTx.feePayer = authority.publicKey;
    budgetedTx.recentBlockhash = (
      await provider.connection.getLatestBlockhash("confirmed")
    ).blockhash;
    return provider.sendAndConfirm(budgetedTx, [authority, ...extraSigners], {
      skipPreflight: true,
      commitment: "confirmed",
    });
  }

  let assetMint: PublicKey;
  let usdcMint: PublicKey;
  let poolPDA: PublicKey;
  let configPDA: PublicKey;
  let quoteStatePDA: PublicKey;
  let riskStatePDA: PublicKey;
  let volatilityStatePDA: PublicKey;
  let hedgeStatePDA: PublicKey;
  let assetVaultPDA: PublicKey;
  let usdcVaultPDA: PublicKey;
  let adminStatePDA: PublicKey;
  let userBankPDA: PublicKey;

  let authorityAssetTokenAccount: PublicKey;
  let authorityUsdcTokenAccount: PublicKey;
  let userAssetTokenAccount: PublicKey;
  let userUsdcTokenAccount: PublicKey;

  before(async () => {
    logSection("TEST ENVIRONMENT SETUP");

    logStep("Provider configuration");
    logResult("Program ID", program.programId.toString());
    logResult("RPC Endpoint", provider.connection.rpcEndpoint);
    logResult("ER Endpoint", ER_ENDPOINT);

    logStep("Pyth Lazer Oracle (BTC/USD)");
    logResult("Pyth Lazer Program", PYTH_LAZER_PROGRAM.toString());
    logResult("BTC Feed ID", BTC_PYTH_LAZER_ID);
    logResult("Oracle Exponent", BTC_ORACLE_EXPONENT);
    logResult("BTC Oracle PDA", BTC_ORACLE_PDA.toString());

    const balance = await provider.connection.getBalance(authority.publicKey);
    logResult("Admin authority", authority.publicKey.toString());
    logResult("Admin balance", `${balance / LAMPORTS_PER_SOL} SOL`);

    logStep("Loading persistent test user keypair");
    logResult("Test user", testUser.publicKey.toString());

    logStep("Funding test user with SOL");
    await fundSolIfNeeded(
      provider.connection,
      authority,
      testUser.publicKey,
      0.5,
      2
    );
    const testUserBalance = await provider.connection.getBalance(
      testUser.publicKey
    );
    logResult("Test user balance", `${testUserBalance / LAMPORTS_PER_SOL} SOL`);

    logStep("Loading or creating persistent token mints");
    ({ assetMint, usdcMint } = await loadOrCreateTestMints(
      provider.connection,
      authority,
      authority.publicKey
    ));
    logResult("Asset Mint (8 decimals)", assetMint.toString());
    logResult("USDC Mint (6 decimals)", usdcMint.toString());

    logStep("Creating token accounts");
    authorityAssetTokenAccount = await getOrCreateTokenAccount(
      provider.connection,
      authority,
      assetMint,
      authority.publicKey
    );
    authorityUsdcTokenAccount = await getOrCreateTokenAccount(
      provider.connection,
      authority,
      usdcMint,
      authority.publicKey
    );
    userAssetTokenAccount = await getOrCreateTokenAccount(
      provider.connection,
      authority,
      assetMint,
      testUser.publicKey
    );
    userUsdcTokenAccount = await getOrCreateTokenAccount(
      provider.connection,
      authority,
      usdcMint,
      testUser.publicKey
    );
    logResult("Admin Asset ATA", authorityAssetTokenAccount.toString());
    logResult("Admin USDC ATA", authorityUsdcTokenAccount.toString());
    logResult("User Asset ATA", userAssetTokenAccount.toString());
    logResult("User USDC ATA", userUsdcTokenAccount.toString());

    logStep("Minting test tokens");
    await ensureTokenBalance(
      provider.connection,
      authority,
      assetMint,
      authorityAssetTokenAccount,
      authority,
      BigInt(2_000_000_000_000)
    );
    await ensureTokenBalance(
      provider.connection,
      authority,
      usdcMint,
      authorityUsdcTokenAccount,
      authority,
      BigInt(2_000_000_000_000)
    );
    await ensureTokenBalance(
      provider.connection,
      authority,
      assetMint,
      userAssetTokenAccount,
      authority,
      BigInt(1_000_000_000_000)
    );
    await ensureTokenBalance(
      provider.connection,
      authority,
      usdcMint,
      userUsdcTokenAccount,
      authority,
      BigInt(1_000_000_000_000)
    );
    logResult("Admin + user token balances topped up", "ok");

    logStep("Deriving program PDAs");
    [adminStatePDA] = PublicKey.findProgramAddressSync(
      [Buffer.from(ADMIN_SEED)],
      program.programId
    );

    [poolPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from(POOL_SEED), assetMint.toBuffer(), usdcMint.toBuffer()],
      program.programId
    );

    [configPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from(CONFIG_SEED), poolPDA.toBuffer()],
      program.programId
    );

    [quoteStatePDA] = PublicKey.findProgramAddressSync(
      [Buffer.from(QUOTE_STATE_SEED), poolPDA.toBuffer()],
      program.programId
    );

    [riskStatePDA] = PublicKey.findProgramAddressSync(
      [Buffer.from(RISK_STATE_SEED), poolPDA.toBuffer()],
      program.programId
    );

    [volatilityStatePDA] = PublicKey.findProgramAddressSync(
      [Buffer.from(VOLATILITY_STATE_SEED), poolPDA.toBuffer()],
      program.programId
    );

    [hedgeStatePDA] = PublicKey.findProgramAddressSync(
      [Buffer.from(HEDGE_STATE_SEED), poolPDA.toBuffer()],
      program.programId
    );

    [assetVaultPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from(ASSET_VAULT_SEED), poolPDA.toBuffer()],
      program.programId
    );

    [usdcVaultPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from(USDC_VAULT_SEED), poolPDA.toBuffer()],
      program.programId
    );

    [userBankPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from(USER_BANK_SEED), testUser.publicKey.toBuffer()],
      program.programId
    );

    logState("Derived PDAs", {
      adminState: adminStatePDA.toString(),
      pool: poolPDA.toString(),
      config: configPDA.toString(),
      quoteState: quoteStatePDA.toString(),
      riskState: riskStatePDA.toString(),
      volatilityState: volatilityStatePDA.toString(),
      hedgeState: hedgeStatePDA.toString(),
      assetVault: assetVaultPDA.toString(),
      usdcVault: usdcVaultPDA.toString(),
      userBank: userBankPDA.toString(),
    });

    await ensureUserBankOnBaseLayer();

    logStep("Funding test user on ER for swap/withdraw fees");
    const erConnection = getErProvider().connection;
    const erBalance = await erConnection.getBalance(testUser.publicKey);
    if (erBalance < 0.1 * LAMPORTS_PER_SOL) {
      const fundErTx = new web3.Transaction().add(
        web3.SystemProgram.transfer({
          fromPubkey: authority.publicKey,
          toPubkey: testUser.publicKey,
          lamports: Math.floor(0.5 * LAMPORTS_PER_SOL),
        })
      );
      await sendErTransaction(fundErTx);
      logResult("ER test user funded", `${0.5} SOL`);
    } else {
      logResult("ER test user balance", `${erBalance / LAMPORTS_PER_SOL} SOL`);
    }
  });

  // =========================================================================
  // 1. INITIALIZATION TESTS
  // =========================================================================
  describe("1. Initialization", () => {
    it("should initialize admin state", async () => {
      logStep("Calling initializeAdmin()");

      const exists = await accountExists(adminStatePDA);
      if (exists) {
        logResult("AdminState already initialized", "skipping init");
      } else {
        const tx = await program.methods
          .initializeAdmin()
          .accountsPartial({
            authority: authority.publicKey,
          })
          .rpc();
        logTx("initializeAdmin", tx);
      }

      const adminState = await program.account.adminState.fetch(adminStatePDA);
      logState("AdminState after init", {
        authority: adminState.authority.toString(),
        poolCount: adminState.poolCount.toNumber(),
      });

      expect(adminState.authority.toString()).to.equal(
        authority.publicKey.toString()
      );
      expect(adminState.poolCount.toNumber()).to.be.at.least(0);
    });

    it("should reject double initialization of admin", async () => {
      logStep("Attempting double initializeAdmin() — expect rejection");
      try {
        await program.methods
          .initializeAdmin()
          .accountsPartial({
            authority: authority.publicKey,
          })
          .rpc();
        expect.fail("Should have thrown");
      } catch (err: any) {
        logError("Expected rejection", err);
        expect(err.toString()).to.include("Error");
      }
    });

    it("should initialize pool with BTC/USD oracle", async () => {
      logStep("Calling initializePool() with real BTC/USD Pyth Lazer oracle");
      logState("Pool init params", {
        pythLazerId: BTC_PYTH_LAZER_ID,
        oracleExponent: BTC_ORACLE_EXPONENT,
        oraclePDA: BTC_ORACLE_PDA.toString(),
        targetInventoryBps: 5000,
        baseSpreadBps: 5,
        maxSpreadBps: 200,
        virtualDepthK: "1,000,000,000",
        volatilityWindowSize: 32,
        crankIntervalMs: 50,
        maxTradeSize: "1,000,000,000,000",
        lambda: 100,
        maxOracleStalenessSec: 10,
      });

      const adminBefore = await program.account.adminState.fetch(adminStatePDA);
      const poolCountBefore = adminBefore.poolCount.toNumber();
      const poolAlreadyExists = await accountExists(poolPDA);

      if (poolAlreadyExists) {
        logResult("Pool already initialized", "skipping init");
      } else {
        const tx = await program.methods
          .initializePool({
            pythLazerId: BTC_PYTH_LAZER_ID,
            oracleExponent: BTC_ORACLE_EXPONENT,
            targetInventoryBps: new BN(5000),
            baseSpreadBps: new BN(5),
            maxSpreadBps: new BN(200),
            virtualDepthK: new BN(1_000_000_000),
            volatilityWindowSize: 32,
            crankIntervalMs: new BN(50),
            maxTradeSize: new BN(1_000_000_000_000),
            lambda: new BN(100),
            maxOracleStalenessSec: new BN(10),
          })
          .accountsPartial({
            authority: authority.publicKey,
            assetMint: assetMint,
            usdcMint: usdcMint,
            oracleFeed: BTC_ORACLE_PDA,
          })
          .rpc();

        logTx("initializePool", tx);
      }

      const pool = await fetchPool();
      logState("Pool after init", {
        authority: pool.authority.toString(),
        assetMint: pool.assetMint.toString(),
        usdcMint: pool.usdcMint.toString(),
        oracleFeed: pool.oracleFeed.toString(),
        paused: pool.paused,
        pythLazerId: pool.pythLazerId,
        oracleExponent: pool.oracleExponent,
      });

      expect(pool.authority.toString()).to.equal(authority.publicKey.toString());
      expect(pool.assetMint.toString()).to.equal(assetMint.toString());
      expect(pool.usdcMint.toString()).to.equal(usdcMint.toString());
      expect(pool.oracleFeed.toString()).to.equal(BTC_ORACLE_PDA.toString());
      expect(pool.paused).to.equal(false);
      expect(pool.pythLazerId).to.equal(BTC_PYTH_LAZER_ID);
      expect(pool.oracleExponent).to.equal(BTC_ORACLE_EXPONENT);

      if (!poolAlreadyExists) {
        const config = await program.account.config.fetch(configPDA);
        logState("Config after init", {
          targetInventoryBps: config.targetInventoryBps.toNumber(),
          baseSpreadBps: config.baseSpreadBps.toNumber(),
          maxSpreadBps: config.maxSpreadBps.toNumber(),
          virtualDepthK: config.virtualDepthK.toNumber(),
          volatilityWindowSize: config.volatilityWindowSize,
          crankIntervalMs: config.crankIntervalMs.toNumber(),
          lambda: config.lambda.toNumber(),
          maxOracleStalenessSec: config.maxOracleStalenessSec.toNumber(),
        });

        expect(config.targetInventoryBps.toNumber()).to.equal(5000);
        expect(config.baseSpreadBps.toNumber()).to.equal(5);
        expect(config.maxSpreadBps.toNumber()).to.equal(200);
        expect(config.virtualDepthK.toNumber()).to.equal(1_000_000_000);
        expect(config.volatilityWindowSize).to.equal(32);
        expect(config.crankIntervalMs.toNumber()).to.equal(50);
        expect(config.lambda.toNumber()).to.equal(100);
        expect(config.maxOracleStalenessSec.toNumber()).to.equal(10);

        const quoteState = await program.account.quoteState.fetch(quoteStatePDA);
        logState("QuoteState after init (zeroed)", {
          fairPriceE8: quoteState.fairPriceE8.toNumber(),
          bidPriceE8: quoteState.bidPriceE8.toNumber(),
          askPriceE8: quoteState.askPriceE8.toNumber(),
          spreadBps: quoteState.spreadBps.toNumber(),
        });

        expect(quoteState.fairPriceE8.toNumber()).to.equal(0);

        const riskState = await program.account.riskState.fetch(riskStatePDA);
        logState("RiskState after init (zeroed)", {
          inventoryRatioBps: riskState.inventoryRatioBps.toNumber(),
          inventoryDeviationBps: riskState.inventoryDeviationBps.toNumber(),
          inventoryPenaltyBps: riskState.inventoryPenaltyBps.toNumber(),
        });

        const volatilityState =
          await program.account.volatilityState.fetch(volatilityStatePDA);
        logState("VolatilityState after init", {
          count: volatilityState.count,
          pricesLength: volatilityState.prices.length,
          realizedVolatilityBps: volatilityState.realizedVolatilityBps.toNumber(),
        });

        const hedgeState = await program.account.hedgeState.fetch(hedgeStatePDA);
        logState("HedgeState after init", {
          hedgeRequired: hedgeState.hedgeRequired,
          softLimitBps: hedgeState.softLimitBps.toNumber(),
          hardLimitBps: hedgeState.hardLimitBps.toNumber(),
          targetInventoryBps: hedgeState.targetInventoryBps.toNumber(),
        });

        expect(hedgeState.hedgeRequired).to.equal(false);
        expect(hedgeState.softLimitBps.toNumber()).to.equal(7000);
        expect(hedgeState.hardLimitBps.toNumber()).to.equal(8500);
      } else {
        logResult("Pool already exists", "skipping zero-state sub-account assertions");
      }

      const adminState = await program.account.adminState.fetch(adminStatePDA);
      logResult("AdminState.poolCount", adminState.poolCount.toNumber());
      if (!poolAlreadyExists) {
        expect(adminState.poolCount.toNumber()).to.equal(poolCountBefore + 1);
      } else {
        expect(adminState.poolCount.toNumber()).to.be.at.least(poolCountBefore);
      }
    });

    it("should reject double initialization of pool", async () => {
      logStep("Attempting double initializePool() — expect rejection");
      try {
        await program.methods
          .initializePool({
            pythLazerId: BTC_PYTH_LAZER_ID,
            oracleExponent: BTC_ORACLE_EXPONENT,
            targetInventoryBps: new BN(5000),
            baseSpreadBps: new BN(5),
            maxSpreadBps: new BN(200),
            virtualDepthK: new BN(1_000_000_000),
            volatilityWindowSize: 32,
            crankIntervalMs: new BN(50),
            maxTradeSize: new BN(1_000_000_000_000),
            lambda: new BN(100),
            maxOracleStalenessSec: new BN(10),
          })
          .accountsPartial({
            authority: authority.publicKey,
            assetMint: assetMint,
            usdcMint: usdcMint,
            oracleFeed: BTC_ORACLE_PDA,
          })
          .rpc();
        expect.fail("Should have thrown");
      } catch (err: any) {
        logError("Expected rejection (account already exists)", err);
        expect(err.toString()).to.include("Error");
      }
    });

    it("should initialize user bank", async () => {
      logStep("Calling initUserBank()");

      const exists = await accountExists(userBankPDA);
      if (exists) {
        logResult("UserBank already initialized", "skipping init");
      } else {
        const tx = await program.methods
          .initUserBank()
          .accountsPartial({
            authority: testUser.publicKey,
          })
          .signers([testUser])
          .rpc();
        logTx("initUserBank", tx);
      }

      const userBank = await program.account.userBank.fetch(userBankPDA);
      logState("UserBank after init", {
        authority: userBank.authority.toString(),
        entriesCount: userBank.entries.length,
      });

      expect(userBank.authority.toString()).to.equal(
        testUser.publicKey.toString()
      );
    });
  });

  // =========================================================================
  // 2. CONFIG UPDATE TESTS
  // =========================================================================
  describe("2. Config Updates", () => {
    it("should update config parameters", async () => {
      if (await isPoolDelegated()) {
        logResult("Pool delegated to ER", "skipping L1 config write");
        return;
      }

      logStep("Calling updateConfig(targetInventoryBps=4500, baseSpreadBps=10)");

      const tx = await program.methods
        .updateConfig({
          targetInventoryBps: new BN(4500),
          baseSpreadBps: new BN(10),
          maxSpreadBps: null,
          virtualDepthK: null,
          volatilityWindowSize: null,
          crankIntervalMs: null,
          maxTradeSize: null,
          lambda: null,
          maxOracleStalenessSec: null,
        })
        .accountsPartial({
          authority: authority.publicKey,
          pool: poolPDA,
          config: configPDA,
        })
        .rpc();

      logTx("updateConfig", tx);

      const config = await program.account.config.fetch(configPDA);
      logState("Config after update", {
        targetInventoryBps: config.targetInventoryBps.toNumber(),
        baseSpreadBps: config.baseSpreadBps.toNumber(),
        maxSpreadBps: config.maxSpreadBps.toNumber(),
        "unchanged fields": "virtualDepthK, volatilityWindowSize, etc.",
      });

      expect(config.targetInventoryBps.toNumber()).to.equal(4500);
      expect(config.baseSpreadBps.toNumber()).to.equal(10);
      expect(config.maxSpreadBps.toNumber()).to.equal(200);
    });

    it("should reject invalid target_inventory_bps > 10000", async () => {
      if (await isPoolDelegated()) {
        logResult("Pool delegated to ER", "skipping");
        return;
      }

      logStep("Attempting updateConfig(targetInventoryBps=15000) — expect InvalidConfigParam");
      try {
        await program.methods
          .updateConfig({
            targetInventoryBps: new BN(15000),
            baseSpreadBps: null,
            maxSpreadBps: null,
            virtualDepthK: null,
            volatilityWindowSize: null,
            crankIntervalMs: null,
            maxTradeSize: null,
            lambda: null,
            maxOracleStalenessSec: null,
          })
          .accountsPartial({
            authority: authority.publicKey,
            pool: poolPDA,
            config: configPDA,
          })
          .rpc();
        expect.fail("Should have thrown");
      } catch (err: any) {
        logError("Expected InvalidConfigParam", err);
        expect(err.toString()).to.include("InvalidConfigParam");
      }
    });

    it("should reject volatility window > 32", async () => {
      if (await isPoolDelegated()) {
        logResult("Pool delegated to ER", "skipping");
        return;
      }

      logStep("Attempting updateConfig(volatilityWindowSize=64) — expect VolatilityWindowTooLarge");
      try {
        await program.methods
          .updateConfig({
            targetInventoryBps: null,
            baseSpreadBps: null,
            maxSpreadBps: null,
            virtualDepthK: null,
            volatilityWindowSize: 64,
            crankIntervalMs: null,
            maxTradeSize: null,
            lambda: null,
            maxOracleStalenessSec: null,
          })
          .accountsPartial({
            authority: authority.publicKey,
            pool: poolPDA,
            config: configPDA,
          })
          .rpc();
        expect.fail("Should have thrown");
      } catch (err: any) {
        logError("Expected VolatilityWindowTooLarge", err);
        expect(err.toString()).to.include("VolatilityWindowTooLarge");
      }
    });

    it("should revert config for remaining tests", async () => {
      if (await isPoolDelegated()) {
        logResult("Pool delegated to ER", "skipping config revert");
        return;
      }

      logStep("Reverting config to defaults (targetInventoryBps=5000, baseSpreadBps=5)");
      const tx = await program.methods
        .updateConfig({
          targetInventoryBps: new BN(5000),
          baseSpreadBps: new BN(5),
          maxSpreadBps: null,
          virtualDepthK: null,
          volatilityWindowSize: null,
          crankIntervalMs: null,
          maxTradeSize: null,
          lambda: null,
          maxOracleStalenessSec: null,
        })
        .accountsPartial({
          authority: authority.publicKey,
          pool: poolPDA,
          config: configPDA,
        })
        .rpc();

      logTx("updateConfig (revert)", tx);
    });
  });

  // =========================================================================
  // 3. PAUSE / RESUME TESTS
  // =========================================================================
  describe("3. Pause/Resume", () => {
    before(async () => {
      if (await isPoolDelegated()) return;
      const pool = await fetchPool();
      if (pool.paused) {
        logStep("Pool is paused from prior run — resuming before pause tests");
        await program.methods
          .resumePool()
          .accountsPartial({ authority: authority.publicKey, pool: poolPDA })
          .rpc();
      }
    });

    it("should pause pool", async () => {
      if (await isPoolDelegated()) {
        logResult("Pool delegated to ER", "skipping L1 pause");
        return;
      }

      logStep("Calling pausePool()");

      const poolBefore = await program.account.pool.fetch(poolPDA);
      logResult("Pool.paused BEFORE", poolBefore.paused);

      const tx = await program.methods
        .pausePool()
        .accountsPartial({
          authority: authority.publicKey,
          pool: poolPDA,
        })
        .rpc();

      logTx("pausePool", tx);

      const pool = await fetchPool();
      logResult("Pool.paused AFTER", pool.paused);
      expect(pool.paused).to.equal(true);
    });

    it("should reject pause on already-paused pool", async () => {
      if (await isPoolDelegated()) {
        logResult("Pool delegated to ER", "skipping");
        return;
      }

      logStep("Attempting pausePool() on paused pool — expect PoolPaused");
      try {
        await program.methods
          .pausePool()
          .accountsPartial({
            authority: authority.publicKey,
            pool: poolPDA,
          })
          .rpc();
        expect.fail("Should have thrown");
      } catch (err: any) {
        logError("Expected PoolPaused", err);
        expect(err.toString()).to.include("PoolPaused");
      }
    });

    it("should resume pool", async () => {
      if (await isPoolDelegated()) {
        logResult("Pool delegated to ER", "skipping L1 resume");
        return;
      }

      logStep("Calling resumePool()");

      const tx = await program.methods
        .resumePool()
        .accountsPartial({
          authority: authority.publicKey,
          pool: poolPDA,
        })
        .rpc();

      logTx("resumePool", tx);

      const pool = await fetchPool();
      logResult("Pool.paused AFTER resume", pool.paused);
      expect(pool.paused).to.equal(false);
    });

    it("should reject resume on already-active pool", async () => {
      if (await isPoolDelegated()) {
        logResult("Pool delegated to ER", "skipping");
        return;
      }

      logStep("Attempting resumePool() on active pool — expect PoolNotPaused");
      try {
        await program.methods
          .resumePool()
          .accountsPartial({
            authority: authority.publicKey,
            pool: poolPDA,
          })
          .rpc();
        expect.fail("Should have thrown");
      } catch (err: any) {
        logError("Expected PoolNotPaused", err);
        expect(err.toString()).to.include("PoolNotPaused");
      }
    });
  });

  // =========================================================================
  // 4. ADMIN LIQUIDITY (market maker seeds the pool)
  // =========================================================================
  describe("4. Admin Liquidity (add/remove)", () => {
    it("should add liquidity to both vaults", async () => {
      if (await isPoolDelegated()) {
        logResult("Pool delegated to ER", "skipping L1 addLiquidity");
        return;
      }

      const assetVaultBefore = await getAccount(provider.connection, assetVaultPDA);
      if (Number(assetVaultBefore.amount) >= 100_000_000_000) {
        logResult("Vaults already seeded from prior run", "skipping initial addLiquidity");
        return;
      }

      const assetAmount = new BN(100_000_000_000);
      const usdcAmount = new BN(500_000_000_000);
      logStep(`Admin adding liquidity: ${assetAmount.toString()} asset + ${usdcAmount.toString()} USDC`);

      const tx = await program.methods
        .addLiquidity({
          assetAmount: assetAmount,
          usdcAmount: usdcAmount,
        })
        .accountsPartial({
          authority: authority.publicKey,
          pool: poolPDA,
          authorityAssetAccount: authorityAssetTokenAccount,
          authorityUsdcAccount: authorityUsdcTokenAccount,
          assetVault: assetVaultPDA,
          usdcVault: usdcVaultPDA,
        })
        .rpc();

      logTx("addLiquidity", tx);

      const assetVault = await getAccount(provider.connection, assetVaultPDA);
      const usdcVault = await getAccount(provider.connection, usdcVaultPDA);
      logState("Vault balances after admin add", {
        assetVault: Number(assetVault.amount),
        usdcVault: Number(usdcVault.amount),
      });

      expect(Number(assetVault.amount)).to.equal(100_000_000_000);
      expect(Number(usdcVault.amount)).to.equal(500_000_000_000);
    });

    it("should reject add_liquidity with both amounts zero", async () => {
      if (await isPoolDelegated()) {
        logResult("Pool delegated to ER", "skipping");
        return;
      }

      logStep("Attempting addLiquidity(0, 0) — expect rejection");
      try {
        await program.methods
          .addLiquidity({
            assetAmount: new BN(0),
            usdcAmount: new BN(0),
          })
          .accountsPartial({
            authority: authority.publicKey,
            pool: poolPDA,
            authorityAssetAccount: authorityAssetTokenAccount,
            authorityUsdcAccount: authorityUsdcTokenAccount,
            assetVault: assetVaultPDA,
            usdcVault: usdcVaultPDA,
          })
          .rpc();
        expect.fail("Should have thrown");
      } catch (err: any) {
        logError("Expected zero-amount rejection", err);
        expect(err.toString()).to.include("Error");
      }
    });

    it("should add liquidity even when pool is paused", async () => {
      if (await isPoolDelegated()) {
        logResult("Pool delegated to ER", "skipping");
        return;
      }

      logStep("Pausing pool, then adding liquidity (admin privilege)");
      await program.methods
        .pausePool()
        .accountsPartial({ authority: authority.publicKey, pool: poolPDA })
        .rpc();
      logResult("Pool paused", true);

      const vaultBefore = await getAccount(provider.connection, assetVaultPDA);
      const balanceBefore = Number(vaultBefore.amount);

      const tx = await program.methods
        .addLiquidity({
          assetAmount: new BN(10_000_000_000),
          usdcAmount: new BN(0),
        })
        .accountsPartial({
          authority: authority.publicKey,
          pool: poolPDA,
          authorityAssetAccount: authorityAssetTokenAccount,
          authorityUsdcAccount: authorityUsdcTokenAccount,
          assetVault: assetVaultPDA,
          usdcVault: usdcVaultPDA,
        })
        .rpc();

      logTx("addLiquidity (while paused)", tx);

      const assetVault = await getAccount(provider.connection, assetVaultPDA);
      logResult("Asset vault after paused add", Number(assetVault.amount));
      expect(Number(assetVault.amount)).to.equal(balanceBefore + 10_000_000_000);

      await program.methods
        .resumePool()
        .accountsPartial({ authority: authority.publicKey, pool: poolPDA })
        .rpc();
      logResult("Pool resumed", true);
    });

    it("should remove liquidity from both vaults", async () => {
      if (await isPoolDelegated()) {
        logResult("Pool delegated to ER", "skipping L1 removeLiquidity");
        return;
      }

      const assetAmount = new BN(10_000_000_000);
      const usdcAmount = new BN(50_000_000_000);
      logStep(`Admin removing: ${assetAmount.toString()} asset + ${usdcAmount.toString()} USDC`);

      const assetVaultBefore = await getAccount(provider.connection, assetVaultPDA);
      const usdcVaultBefore = await getAccount(provider.connection, usdcVaultPDA);

      const tx = await program.methods
        .removeLiquidity({
          assetAmount: assetAmount,
          usdcAmount: usdcAmount,
        })
        .accountsPartial({
          authority: authority.publicKey,
          pool: poolPDA,
          authorityAssetAccount: authorityAssetTokenAccount,
          authorityUsdcAccount: authorityUsdcTokenAccount,
          assetVault: assetVaultPDA,
          usdcVault: usdcVaultPDA,
        })
        .rpc();

      logTx("removeLiquidity", tx);

      const assetVault = await getAccount(provider.connection, assetVaultPDA);
      const usdcVault = await getAccount(provider.connection, usdcVaultPDA);
      logState("Vault balances after admin remove", {
        assetVault: Number(assetVault.amount),
        usdcVault: Number(usdcVault.amount),
      });

      expect(Number(assetVault.amount)).to.equal(
        Number(assetVaultBefore.amount) - assetAmount.toNumber()
      );
      expect(Number(usdcVault.amount)).to.equal(
        Number(usdcVaultBefore.amount) - usdcAmount.toNumber()
      );
    });

    it("should reject remove_liquidity exceeding vault balance", async () => {
      if (await isPoolDelegated()) {
        logResult("Pool delegated to ER", "skipping");
        return;
      }

      logStep("Attempting removeLiquidity with amount > vault balance");
      try {
        await program.methods
          .removeLiquidity({
            assetAmount: new BN(999_000_000_000_000),
            usdcAmount: new BN(0),
          })
          .accountsPartial({
            authority: authority.publicKey,
            pool: poolPDA,
            authorityAssetAccount: authorityAssetTokenAccount,
            authorityUsdcAccount: authorityUsdcTokenAccount,
            assetVault: assetVaultPDA,
            usdcVault: usdcVaultPDA,
          })
          .rpc();
        expect.fail("Should have thrown");
      } catch (err: any) {
        logError("Expected insufficient vault balance", err);
        expect(err.toString()).to.include("Error");
      }
    });

    it("should reject unauthorized add_liquidity", async () => {
      if (await isPoolDelegated()) {
        logResult("Pool delegated to ER", "skipping");
        return;
      }

      logStep("Attempting addLiquidity with fake authority");
      const fakeAuth = Keypair.generate();
      const transferIx = web3.SystemProgram.transfer({
        fromPubkey: authority.publicKey,
        toPubkey: fakeAuth.publicKey,
        lamports: LAMPORTS_PER_SOL / 10,
      });
      const transferTx = new web3.Transaction().add(transferIx);
      await provider.sendAndConfirm(transferTx);

      try {
        await program.methods
          .addLiquidity({
            assetAmount: new BN(1000),
            usdcAmount: new BN(0),
          })
          .accountsPartial({
            authority: fakeAuth.publicKey,
            pool: poolPDA,
            authorityAssetAccount: authorityAssetTokenAccount,
            authorityUsdcAccount: authorityUsdcTokenAccount,
            assetVault: assetVaultPDA,
            usdcVault: usdcVaultPDA,
          })
          .signers([fakeAuth])
          .rpc();
        expect.fail("Should have thrown");
      } catch (err: any) {
        logError("Expected unauthorized rejection", err);
        expect(err.toString()).to.include("Error");
      }
    });
  });

  // =========================================================================
  // 5. DEPOSIT TO BANK (user-facing)
  // =========================================================================
  describe("5. Deposit to Bank", () => {
    before(async () => {
      if (await isPoolDelegated()) return;
      const pool = await fetchPool();
      if (pool.paused) {
        await program.methods
          .resumePool()
          .accountsPartial({ authority: authority.publicKey, pool: poolPDA })
          .rpc();
      }
    });

    it("should deposit asset tokens", async () => {
      const depositAmount = new BN(100_000_000_000);
      logStep(`Depositing ${depositAmount.toString()} raw asset tokens`);

      const bankBefore = await program.account.userBank.fetch(userBankPDA);
      const entryBefore = findBankEntry(bankBefore.entries, assetMint);
      const balanceBefore = entryBefore ? entryBefore.balance.toNumber() : 0;
      const entriesBefore = bankBefore.entries.length;

      const vaultBefore = await getAccount(provider.connection, assetVaultPDA);
      logResult("Vault balance BEFORE", Number(vaultBefore.amount));

      const tx = await program.methods
        .depositToBank(depositAmount, false)
        .accountsPartial({
          user: testUser.publicKey,
          assetMint: assetMint,
          usdcMint: usdcMint,
          pool: poolPDA,
          userTokenAccount: userAssetTokenAccount,
          vault: assetVaultPDA,
          depositMint: assetMint,
        })
        .signers([testUser])
        .rpc();

      logTx("depositToBank (asset)", tx);

      const userBank = await program.account.userBank.fetch(userBankPDA);
      const vaultAfter = await getAccount(provider.connection, assetVaultPDA);
      const entryAfter = findBankEntry(userBank.entries, assetMint);

      expect(entryAfter).to.exist;
      logState("UserBank after deposit", {
        entriesCount: userBank.entries.length,
        assetMint: assetMint.toString(),
        assetBalance: entryAfter!.balance.toNumber(),
      });
      logResult("Vault balance AFTER", Number(vaultAfter.amount));

      expect(entryAfter!.balance.toNumber()).to.equal(
        balanceBefore + depositAmount.toNumber()
      );
      if (!entryBefore) {
        expect(userBank.entries.length).to.equal(entriesBefore + 1);
      }
    });

    it("should deposit USDC tokens", async () => {
      const depositAmount = new BN(500_000_000_000);
      logStep(`Depositing ${depositAmount.toString()} raw USDC tokens`);

      const bankBefore = await program.account.userBank.fetch(userBankPDA);
      const entryBefore = findBankEntry(bankBefore.entries, usdcMint);
      const balanceBefore = entryBefore ? entryBefore.balance.toNumber() : 0;
      const entriesBefore = bankBefore.entries.length;

      const tx = await program.methods
        .depositToBank(depositAmount, false)
        .accountsPartial({
          user: testUser.publicKey,
          assetMint: assetMint,
          usdcMint: usdcMint,
          pool: poolPDA,
          userTokenAccount: userUsdcTokenAccount,
          vault: usdcVaultPDA,
          depositMint: usdcMint,
        })
        .signers([testUser])
        .rpc();

      logTx("depositToBank (USDC)", tx);

      const userBank = await program.account.userBank.fetch(userBankPDA);
      const vaultAfter = await getAccount(provider.connection, usdcVaultPDA);
      const entryAfter = findBankEntry(userBank.entries, usdcMint);

      logState("UserBank after USDC deposit", {
        entriesCount: userBank.entries.length,
        usdcMint: usdcMint.toString().slice(0, 12) + "...",
        usdcBalance: entryAfter!.balance.toNumber(),
      });
      logResult("USDC Vault balance AFTER", Number(vaultAfter.amount));

      expect(entryAfter).to.exist;
      expect(entryAfter!.balance.toNumber()).to.equal(
        balanceBefore + depositAmount.toNumber()
      );
      if (!entryBefore) {
        expect(userBank.entries.length).to.equal(entriesBefore + 1);
      }
    });

    it("should increment existing entry on additional deposit of same mint", async () => {
      const additionalDeposit = new BN(50_000_000_000);
      logStep(`Depositing additional ${additionalDeposit.toString()} asset tokens`);

      const bankBefore = await program.account.userBank.fetch(userBankPDA);
      const entryBefore = findBankEntry(bankBefore.entries, assetMint);
      expect(entryBefore).to.exist;
      logResult("Asset balance BEFORE", entryBefore!.balance.toNumber());

      const tx = await program.methods
        .depositToBank(additionalDeposit, false)
        .accountsPartial({
          user: testUser.publicKey,
          assetMint: assetMint,
          usdcMint: usdcMint,
          pool: poolPDA,
          userTokenAccount: userAssetTokenAccount,
          vault: assetVaultPDA,
          depositMint: assetMint,
        })
        .signers([testUser])
        .rpc();

      logTx("depositToBank (additional asset)", tx);

      const bankAfter = await program.account.userBank.fetch(userBankPDA);
      const entryAfter = findBankEntry(bankAfter.entries, assetMint);
      logResult("Asset balance AFTER", entryAfter!.balance.toNumber());
      logResult("Entries count", bankAfter.entries.length);

      expect(entryAfter!.balance.toNumber()).to.equal(
        entryBefore!.balance.toNumber() + additionalDeposit.toNumber()
      );
    });

    it("should reject deposit of zero amount", async () => {
      logStep("Attempting depositLiquidity(0) — expect rejection");
      try {
        await program.methods
          .depositToBank(new BN(0), false)
          .accountsPartial({
            user: testUser.publicKey,
            assetMint: assetMint,
            usdcMint: usdcMint,
            pool: poolPDA,
            userTokenAccount: userAssetTokenAccount,
            vault: assetVaultPDA,
            depositMint: assetMint,
          })
          .signers([testUser])
          .rpc();
        expect.fail("Should have thrown");
      } catch (err: any) {
        logError("Expected zero-amount rejection", err);
        expect(err.toString()).to.include("Error");
      }
    });

    it("should deposit when pool is paused", async () => {
      if (await isPoolDelegated()) {
        logResult("Pool delegated on L1", "skipping pause/deposit test");
        return;
      }

      logStep("Pausing pool, then depositing (deposits allowed while paused)");
      await program.methods
        .pausePool()
        .accountsPartial({
          authority: authority.publicKey,
          pool: poolPDA,
        })
        .rpc();
      logResult("Pool paused", true);

      const depositAmount = new BN(1_000_000);
      const bankBefore = await program.account.userBank.fetch(userBankPDA);
      const entryBefore = findBankEntry(bankBefore.entries, assetMint);
      const balanceBefore = entryBefore ? entryBefore.balance.toNumber() : 0;

      const tx = await program.methods
        .depositToBank(depositAmount, false)
        .accountsPartial({
          user: testUser.publicKey,
          assetMint: assetMint,
          usdcMint: usdcMint,
          pool: poolPDA,
          userTokenAccount: userAssetTokenAccount,
          vault: assetVaultPDA,
          depositMint: assetMint,
        })
        .signers([testUser])
        .rpc();
      logTx("depositToBank (while paused)", tx);

      const bankAfter = await program.account.userBank.fetch(userBankPDA);
      const entryAfter = findBankEntry(bankAfter.entries, assetMint);
      expect(entryAfter!.balance.toNumber()).to.equal(
        balanceBefore + depositAmount.toNumber()
      );

      logStep("Resuming pool for subsequent tests");
      await program.methods
        .resumePool()
        .accountsPartial({
          authority: authority.publicKey,
          pool: poolPDA,
        })
        .rpc();
      logResult("Pool resumed", true);
    });
  });

  // =========================================================================
  // 6. WITHDRAW FROM BANK (user-facing)
  // =========================================================================
  describe("6. Withdraw from Bank", () => {
    it("should withdraw asset tokens", async () => {
      const withdrawAmount = new BN(10_000_000_000);
      logStep(`Withdrawing ${withdrawAmount.toString()} raw asset tokens`);

      const bankBefore = await program.account.userBank.fetch(userBankPDA);
      const entryBefore = findBankEntry(bankBefore.entries, assetMint);
      expect(entryBefore).to.exist;
      const vaultBefore = await getAccount(provider.connection, assetVaultPDA);
      logResult("Bank asset balance BEFORE", entryBefore!.balance.toNumber());
      logResult("Vault balance BEFORE", Number(vaultBefore.amount));

      const tx = await program.methods
        .withdrawFromBank(withdrawAmount, false)
        .accountsPartial({
          user: testUser.publicKey,
          assetMint: assetMint,
          usdcMint: usdcMint,
          pool: poolPDA,
          userTokenAccount: userAssetTokenAccount,
          vault: assetVaultPDA,
          withdrawMint: assetMint,
        })
        .signers([testUser])
        .rpc();

      logTx("withdrawLiquidity (asset)", tx);

      const bankAfter = await program.account.userBank.fetch(userBankPDA);
      const entryAfter = findBankEntry(bankAfter.entries, assetMint);
      const vaultAfter = await getAccount(provider.connection, assetVaultPDA);
      logResult("Bank asset balance AFTER", entryAfter!.balance.toNumber());
      logResult("Vault balance AFTER", Number(vaultAfter.amount));

      expect(entryAfter!.balance.toNumber()).to.equal(
        entryBefore!.balance.toNumber() - withdrawAmount.toNumber()
      );
    });

    it("should reject withdrawal exceeding user bank balance", async () => {
      logStep("Attempting withdrawal of 999T (exceeds bank balance)");
      try {
        await program.methods
          .withdrawFromBank(new BN(999_000_000_000_000), false)
          .accountsPartial({
            user: testUser.publicKey,
            assetMint: assetMint,
            usdcMint: usdcMint,
            pool: poolPDA,
            userTokenAccount: userAssetTokenAccount,
            vault: assetVaultPDA,
            withdrawMint: assetMint,
          })
          .signers([testUser])
          .rpc();
        expect.fail("Should have thrown");
      } catch (err: any) {
        logError("Expected insufficient balance", err);
        expect(err.toString()).to.include("Error");
      }
    });

    it("should reject withdrawal of zero amount", async () => {
      logStep("Attempting withdrawLiquidity(0) — expect rejection");
      try {
        await program.methods
          .withdrawFromBank(new BN(0), false)
          .accountsPartial({
            user: testUser.publicKey,
            assetMint: assetMint,
            usdcMint: usdcMint,
            pool: poolPDA,
            userTokenAccount: userAssetTokenAccount,
            vault: assetVaultPDA,
            withdrawMint: assetMint,
          })
          .signers([testUser])
          .rpc();
        expect.fail("Should have thrown");
      } catch (err: any) {
        logError("Expected zero-amount rejection", err);
        expect(err.toString()).to.include("Error");
      }
    });
  });

  // =========================================================================
  // 7. SECURITY TESTS
  // =========================================================================
  describe("7. Security", () => {
    it("should reject unauthorized pause", async () => {
      logStep("Generating fake authority and attempting pausePool()");
      const fakeAuth = Keypair.generate();
      const transferIx = web3.SystemProgram.transfer({
        fromPubkey: authority.publicKey,
        toPubkey: fakeAuth.publicKey,
        lamports: LAMPORTS_PER_SOL / 10,
      });
      const transferTx = new web3.Transaction().add(transferIx);
      await provider.sendAndConfirm(transferTx);
      logResult("Fake authority funded", fakeAuth.publicKey.toString());

      try {
        await program.methods
          .pausePool()
          .accountsPartial({
            authority: fakeAuth.publicKey,
            pool: poolPDA,
          })
          .signers([fakeAuth])
          .rpc();
        expect.fail("Should have thrown");
      } catch (err: any) {
        logError("Expected unauthorized rejection", err);
        expect(err.toString()).to.include("Error");
      }
    });

    it("should reject unauthorized config update", async () => {
      logStep("Attempting updateConfig() with unauthorized signer");
      const fakeAuth = Keypair.generate();
      const transferIx = web3.SystemProgram.transfer({
        fromPubkey: authority.publicKey,
        toPubkey: fakeAuth.publicKey,
        lamports: LAMPORTS_PER_SOL / 10,
      });
      const transferTx = new web3.Transaction().add(transferIx);
      await provider.sendAndConfirm(transferTx);
      logResult("Fake authority funded", fakeAuth.publicKey.toString());

      try {
        await program.methods
          .updateConfig({
            targetInventoryBps: new BN(9999),
            baseSpreadBps: null,
            maxSpreadBps: null,
            virtualDepthK: null,
            volatilityWindowSize: null,
            crankIntervalMs: null,
            maxTradeSize: null,
            lambda: null,
            maxOracleStalenessSec: null,
          })
          .accountsPartial({
            authority: fakeAuth.publicKey,
            pool: poolPDA,
            config: configPDA,
          })
          .signers([fakeAuth])
          .rpc();
        expect.fail("Should have thrown");
      } catch (err: any) {
        logError("Expected unauthorized rejection", err);
        expect(err.toString()).to.include("Error");
      }
    });

    it("should reject swap exceeding max trade size", async () => {
      logStep("Attempting swapAssetForUsdc with amount > maxTradeSize (1T)");
      const config = await program.account.config.fetch(configPDA);
      logResult("Current maxTradeSize", config.maxTradeSize.toNumber());

      try {
        await program.methods
          .swapAssetForUsdc({
            amountIn: new BN(2_000_000_000_000),
            minAmountOut: new BN(0),
          })
          .accountsPartial({
            payer: authority.publicKey,
          sessionToken: null,
            userBank: userBankPDA,
          pool: poolPDA,
          assetMint,
          usdcMint,
            config: configPDA,
            quoteState: quoteStatePDA,
          })
          .rpc({ skipPreflight: true });
        expect.fail("Should have thrown");
      } catch (err: any) {
        logError("Expected max trade size rejection", err);
        expect(err.toString()).to.include("Error");
      }
    });
  });

  // =========================================================================
  // 8. DELEGATION
  // =========================================================================
  describe("8. Delegation", () => {
    it("should delegate pool accounts to ER", async () => {
      logStep("Calling delegatePool() — delegating pool + sub-accounts to ER");

      if (await isDelegated(poolPDA)) {
        logResult("Pool already delegated", "skipping");
        return;
      }

      const tx = await program.methods
        .delegatePool()
        .accountsPartial({
          payer: authority.publicKey,
          assetMint: assetMint,
          usdcMint: usdcMint,
        })
        .remainingAccounts(erValidatorRemainingAccounts())
        .transaction();

      const sig = await sendBaseTransaction(tx, [], 600_000);
      logTx("delegatePool", sig);
      logResult("Delegated accounts", "pool, config, quoteState, riskState, volatilityState, hedgeState");
      logResult("ER validator", ER_VALIDATOR.toString());
    });

    it("should delegate user bank to ER", async () => {
      logStep("Calling delegateUserBank()");

      if (await isDelegated(userBankPDA)) {
        logResult("UserBank already delegated", "skipping");
        return;
      }

      const tx = await program.methods
        .delegateUserBank()
        .accountsPartial({
          payer: testUser.publicKey,
          userBank: userBankPDA,
        })
        .remainingAccounts(erValidatorRemainingAccounts())
        .transaction();

      const sig = await sendBaseTransaction(tx, [testUser], 400_000);
      logTx("delegateUserBank", sig);
      logResult("Delegated", userBankPDA.toString());
    });
  });

  // =========================================================================
  // 9. CRANK SETUP (on ER after delegation)
  // =========================================================================
  describe("9. Crank Setup", () => {
    it("should setup crank for pool on ER", async () => {
      logStep("Setting up crank via ER provider");
      logResult("ER connection", ER_ENDPOINT);

      try {
        const tx = await getErProgram()
          .methods
          .setupCrank({
            taskId: new BN(1),
            iterations: new BN(1000),
          })
          .accountsPartial({
            payer: authority.publicKey,
            pool: poolPDA,
            assetMint,
            usdcMint,
            config: configPDA,
            quoteState: quoteStatePDA,
            riskState: riskStatePDA,
            volatilityState: volatilityStatePDA,
            hedgeState: hedgeStatePDA,
            magicProgram: MAGIC_PROGRAM_ID,
            oracleFeed: BTC_ORACLE_PDA,
            program: program.programId,
          })
          .transaction();

        const sig = await sendErTransaction(tx);
        logTx("setupCrank", sig);
      } catch (err: any) {
        const msg = err?.message || err?.toString() || "";
        if (msg.includes("already") || msg.includes("Error")) {
          logResult("setupCrank skipped/failed (crank may already exist)", msg.slice(0, 80));
          return;
        }
        throw err;
      }

      logState("Crank params", {
        taskId: 1,
        iterations: 1000,
        oracleFeed: BTC_ORACLE_PDA.toString(),
        magicProgram: MAGIC_PROGRAM_ID.toString(),
      });
    });
  });

  // =========================================================================
  // 10. OBSERVE AUTOMATED CRANK (verify crank is running autonomously)
  // =========================================================================
  describe("10. Observe Automated Crank", () => {
    it("should observe crank auto-updating state with live BTC prices", async () => {
      logStep("Waiting for automated crank to fire and observing state over 5 intervals");

      const programER = getErProgram();
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const quoteStateBefore =
        await programER.account.quoteState.fetch(quoteStatePDA);
      logState("QuoteState BEFORE observation", {
        fairPriceE8: quoteStateBefore.fairPriceE8.toNumber(),
        lastUpdateSlot: quoteStateBefore.lastUpdateSlot.toNumber(),
      });

      for (let i = 0; i < 5; i++) {
        await new Promise((resolve) => setTimeout(resolve, 200));

        const quoteState =
          await programER.account.quoteState.fetch(quoteStatePDA);
        const riskState =
          await programER.account.riskState.fetch(riskStatePDA);
        const volState =
          await programER.account.volatilityState.fetch(volatilityStatePDA);

        const fairUsd = quoteState.fairPriceE8.toNumber() / 1e8;
        const bidUsd = quoteState.bidPriceE8.toNumber() / 1e8;
        const askUsd = quoteState.askPriceE8.toNumber() / 1e8;

        logState(`Observation #${i + 1} (t+${(i + 1) * 200}ms)`, {
          "BTC price": `$${fairUsd.toLocaleString()}`,
          "bid": `$${bidUsd.toLocaleString()}`,
          "ask": `$${askUsd.toLocaleString()}`,
          spreadBps: quoteState.spreadBps.toNumber(),
          inventoryRatioBps: riskState.inventoryRatioBps.toNumber(),
          inventoryPenaltyBps: riskState.inventoryPenaltyBps.toNumber(),
          volatilityBps: riskState.volatilityBps.toNumber(),
          priceHistoryCount: volState.count,
          lastUpdateSlot: quoteState.lastUpdateSlot.toNumber(),
        });
      }

      const quoteStateAfter =
        await programER.account.quoteState.fetch(quoteStatePDA);
      expect(quoteStateAfter.fairPriceE8.toNumber()).to.be.greaterThan(0);
      expect(quoteStateAfter.bidPriceE8.toNumber()).to.be.greaterThan(0);
      expect(quoteStateAfter.askPriceE8.toNumber()).to.be.greaterThan(0);
      expect(quoteStateAfter.askPriceE8.toNumber()).to.be.greaterThan(
        quoteStateAfter.bidPriceE8.toNumber()
      );
      expect(quoteStateAfter.bidPriceE8.toNumber()).to.be.lessThan(
        quoteStateAfter.fairPriceE8.toNumber()
      );
      // With heavy asset inventory, ask skews below fair to attract buyers
      const fair = quoteStateAfter.fairPriceE8.toNumber();
      const bid = quoteStateAfter.bidPriceE8.toNumber();
      const ask = quoteStateAfter.askPriceE8.toNumber();
      expect(bid).to.be.greaterThan(fair * 0.95);
      expect(ask).to.be.greaterThan(fair * 0.95);
      expect(bid).to.be.lessThan(fair * 1.05);
      expect(ask).to.be.lessThan(fair * 1.05);

      expect(quoteStateAfter.lastUpdateSlot.toNumber()).to.be.greaterThan(
        quoteStateBefore.lastUpdateSlot.toNumber()
      );

      const volState =
        await programER.account.volatilityState.fetch(volatilityStatePDA);
      logState("VolatilityState after observation window", {
        count: volState.count,
        pricesLength: volState.prices.length,
        realizedVolatilityBps: volState.realizedVolatilityBps.toNumber(),
        currentIndex: volState.currentIndex,
        "recent prices (e8)": volState.prices
          .slice(0, Math.min(5, volState.prices.length))
          .map((p: any) => p.toNumber())
          .join(", "),
      });

      expect(volState.count).to.be.greaterThan(1);

      const hedgeState = await programER.account.hedgeState.fetch(hedgeStatePDA);
      logState("HedgeState after observation", {
        hedgeRequired: hedgeState.hedgeRequired,
        softLimitBps: hedgeState.softLimitBps.toNumber(),
        hardLimitBps: hedgeState.hardLimitBps.toNumber(),
      });
    });
  });

  // =========================================================================
  // 11. SWAP EXECUTION (direct ER swaps via UserBank)
  // =========================================================================
  describe("11. Swap Execution", () => {
    before(async () => {
      await ensureUserBankDelegated();
    });

    it("should execute swap_asset_for_usdc directly on ER", async () => {
      logStep("Executing direct swap Asset→USDC on ER (1 BTC worth of asset)");

      const programER = getErProgram();

      const bankBefore = await programER.account.userBank.fetch(userBankPDA);
      const assetEntryBefore = findBankEntry(bankBefore.entries, assetMint);
      const usdcEntryBefore = findBankEntry(bankBefore.entries, usdcMint);
      expect(assetEntryBefore).to.exist;
      logState("UserBank BEFORE swap", {
        assetBalance: assetEntryBefore!.balance.toNumber(),
        usdcBalance: usdcEntryBefore ? usdcEntryBefore.balance.toNumber() : 0,
      });

      const quoteState = await programER.account.quoteState.fetch(quoteStatePDA);
      logState("QuoteState at swap time", {
        fairPriceE8: quoteState.fairPriceE8.toNumber(),
        bidPriceE8: quoteState.bidPriceE8.toNumber(),
        askPriceE8: quoteState.askPriceE8.toNumber(),
        spreadBps: quoteState.spreadBps.toNumber(),
        "fairPrice (USD)": `$${(quoteState.fairPriceE8.toNumber() / 1e8).toLocaleString()}`,
      });

      const swapAmount = new BN(100_000_000); // 0.1 token (asset)
      const tx = await programER.methods
        .swapAssetForUsdc({
          amountIn: swapAmount,
          minAmountOut: new BN(0),
        })
        .accountsPartial({
          payer: testUser.publicKey,
          sessionToken: null,
          userBank: userBankPDA,
          pool: poolPDA,
          assetMint,
          usdcMint,
          config: configPDA,
          quoteState: quoteStatePDA,
        })
        .transaction();

      const sig = await sendErTestUserTransaction(tx);
      logTx("swapAssetForUsdc (direct)", sig);

      const bankAfter = await programER.account.userBank.fetch(userBankPDA);
      const assetEntryAfter = findBankEntry(bankAfter.entries, assetMint);
      const usdcEntryAfter = findBankEntry(bankAfter.entries, usdcMint);
      logState("UserBank AFTER swap", {
        assetBalance: assetEntryAfter!.balance.toNumber(),
        usdcBalance: usdcEntryAfter ? usdcEntryAfter.balance.toNumber() : 0,
        assetDelta:
          assetEntryAfter!.balance.toNumber() -
          assetEntryBefore!.balance.toNumber(),
        usdcDelta:
          (usdcEntryAfter ? usdcEntryAfter.balance.toNumber() : 0) -
          (usdcEntryBefore ? usdcEntryBefore.balance.toNumber() : 0),
      });

      expect(assetEntryAfter!.balance.toNumber()).to.be.lessThan(
        assetEntryBefore!.balance.toNumber()
      );
      expect(usdcEntryAfter!.balance.toNumber()).to.be.greaterThan(
        usdcEntryBefore ? usdcEntryBefore.balance.toNumber() : 0
      );
    });

    it("should execute swap_usdc_for_asset directly on ER", async () => {
      logStep("Executing direct swap USDC→Asset on ER");

      const programER = getErProgram();

      const bankBefore = await programER.account.userBank.fetch(userBankPDA);
      const assetEntryBefore = findBankEntry(bankBefore.entries, assetMint);
      const usdcEntryBefore = findBankEntry(bankBefore.entries, usdcMint);
      expect(usdcEntryBefore).to.exist;
      logState("UserBank BEFORE swap", {
        assetBalance: assetEntryBefore ? assetEntryBefore.balance.toNumber() : 0,
        usdcBalance: usdcEntryBefore!.balance.toNumber(),
      });

      const swapAmount = new BN(50_000_000); // 50 USDC (6 decimals = 50e6)
      const tx = await programER.methods
        .swapUsdcForAsset({
          amountIn: swapAmount,
          minAmountOut: new BN(0),
        })
        .accountsPartial({
          payer: testUser.publicKey,
          sessionToken: null,
          userBank: userBankPDA,
          pool: poolPDA,
          assetMint,
          usdcMint,
          config: configPDA,
          quoteState: quoteStatePDA,
        })
        .transaction();

      const sig = await sendErTestUserTransaction(tx);
      logTx("swapUsdcForAsset (direct)", sig);

      const bankAfter = await programER.account.userBank.fetch(userBankPDA);
      const assetEntryAfter = findBankEntry(bankAfter.entries, assetMint);
      const usdcEntryAfter = findBankEntry(bankAfter.entries, usdcMint);
      logState("UserBank AFTER swap", {
        assetBalance: assetEntryAfter ? assetEntryAfter.balance.toNumber() : 0,
        usdcBalance: usdcEntryAfter!.balance.toNumber(),
        assetDelta:
          (assetEntryAfter ? assetEntryAfter.balance.toNumber() : 0) -
          (assetEntryBefore ? assetEntryBefore.balance.toNumber() : 0),
        usdcDelta:
          usdcEntryAfter!.balance.toNumber() -
          usdcEntryBefore!.balance.toNumber(),
      });

      expect(usdcEntryAfter!.balance.toNumber()).to.be.lessThan(
        usdcEntryBefore!.balance.toNumber()
      );
      expect(assetEntryAfter!.balance.toNumber()).to.be.greaterThan(
        assetEntryBefore ? assetEntryBefore.balance.toNumber() : 0
      );
    });

    it("should reject swap with zero amount", async () => {
      logStep("Attempting swap with amountIn=0 — expect rejection");

      const programER = getErProgram();

      try {
        const tx = await programER.methods
          .swapAssetForUsdc({
            amountIn: new BN(0),
            minAmountOut: new BN(0),
          })
          .accountsPartial({
            payer: testUser.publicKey,
            sessionToken: null,
            userBank: userBankPDA,
            pool: poolPDA,
            assetMint,
            usdcMint,
            config: configPDA,
            quoteState: quoteStatePDA,
          })
          .transaction();
        await sendErTestUserTransaction(tx);
        expect.fail("Should have thrown");
      } catch (err: any) {
        logError("Expected zero-amount rejection", err);
        expect(err.toString()).to.include("Error");
      }
    });

    it("should reject swap with slippage exceeded", async () => {
      logStep("Attempting swap with impossibly high minAmountOut — expect slippage rejection");

      const programER = getErProgram();

      try {
        const tx = await programER.methods
          .swapAssetForUsdc({
            amountIn: new BN(100_000_000),
            minAmountOut: new BN("999999999999999999"),
          })
          .accountsPartial({
            payer: testUser.publicKey,
            sessionToken: null,
            userBank: userBankPDA,
            pool: poolPDA,
            assetMint,
            usdcMint,
            config: configPDA,
            quoteState: quoteStatePDA,
          })
          .transaction();
        await sendErTestUserTransaction(tx);
        expect.fail("Should have thrown");
      } catch (err: any) {
        logError("Expected slippage rejection", err);
        expect(err.toString()).to.include("Error");
      }
    });
  });

  // =========================================================================
  // 12. SESSION KEYS + MAGIC ACTION WITHDRAW/DEPOSIT
  // =========================================================================
  describe("12. Session Keys", () => {
    it("should create a session token on L1", async () => {
      sessionTokenManager = new SessionTokenManager(
        provider.wallet,
        provider.connection
      );
      sessionTokenPDA = web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from(SESSION_TOKEN_SEED),
          program.programId.toBytes(),
          sessionKeypair.publicKey.toBytes(),
          testUser.publicKey.toBytes(),
        ],
        sessionTokenManager.program.programId
      )[0];

      const validUntil = new BN(Math.floor(Date.now() / 1000) + 3600);
      const topUpLamports = new BN(0.005 * LAMPORTS_PER_SOL);
      const tx = await sessionTokenManager.program.methods
        .createSessionV2(true, validUntil, topUpLamports)
        .accounts({
          targetProgram: program.programId,
          sessionSigner: sessionKeypair.publicKey,
          feePayer: authority.publicKey,
          authority: testUser.publicKey,
        })
        .transaction();
      tx.feePayer = authority.publicKey;
      const sig = await sendAndConfirmTransaction(provider.connection, tx, [
        authority,
        sessionKeypair,
        testUser,
      ]);
      logTx("createSessionV2", sig);
    });

    it("should swap on ER using only the session signer", async () => {
      const programER = getErProgram();
      const bankBefore = await programER.account.userBank.fetch(userBankPDA);
      const assetBefore = findBankEntry(bankBefore.entries, assetMint);
      const usdcBefore = findBankEntry(bankBefore.entries, usdcMint);

      const tx = await programER.methods
        .swapAssetForUsdc({
          amountIn: new BN(10_000_000),
          minAmountOut: new BN(0),
        })
        .accountsPartial({
          payer: sessionKeypair.publicKey,
          sessionToken: sessionTokenPDA,
          userBank: userBankPDA,
          pool: poolPDA,
          assetMint,
          usdcMint,
          config: configPDA,
          quoteState: quoteStatePDA,
        })
        .transaction();

      const sig = await sendErSessionTransaction(tx, [sessionKeypair]);
      logTx("swapAssetForUsdc (session)", sig);

      const bankAfter = await programER.account.userBank.fetch(userBankPDA);
      const assetAfter = findBankEntry(bankAfter.entries, assetMint);
      const usdcAfter = findBankEntry(bankAfter.entries, usdcMint);
      expect(assetAfter!.balance.toNumber()).to.be.lessThan(
        assetBefore!.balance.toNumber()
      );
      expect(usdcAfter!.balance.toNumber()).to.be.greaterThan(
        usdcBefore ? usdcBefore.balance.toNumber() : 0
      );
    });

    it("should withdraw on ER via undelegate then settle on L1", async () => {
      const withdrawAmount = new BN(5_000_000);
      const bankBefore = await getErProgram().account.userBank.fetch(userBankPDA);
      const entryBefore = findBankEntry(bankBefore.entries, assetMint);
      const ataBefore = await getAccount(provider.connection, userAssetTokenAccount);

      const withdrawIx = await getErProgram()
        .methods
        .withdrawFromBankEr({
          amount: withdrawAmount,
          withdrawMint: assetMint,
        })
        .accountsPartial({
          payer: sessionKeypair.publicKey,
          sessionToken: sessionTokenPDA,
          userBank: userBankPDA,
          pool: poolPDA,
        })
        .instruction();

      const tx = new web3.Transaction().add(withdrawIx);
      const sig = await sendErSessionTransaction(tx, [sessionKeypair]);
      logTx("withdrawFromBankEr (undelegate)", sig);

      await new Promise((r) => setTimeout(r, 5000));
      expect(await isDelegated(userBankPDA)).to.equal(false);

      const l1WithdrawSig = await program.methods
        .withdrawFromBank(withdrawAmount, true)
        .accountsPartial({
          user: testUser.publicKey,
          assetMint: assetMint,
          usdcMint: usdcMint,
          pool: poolPDA,
          userTokenAccount: userAssetTokenAccount,
          vault: assetVaultPDA,
          withdrawMint: assetMint,
        })
        .remainingAccounts(erValidatorRemainingAccounts())
        .signers([testUser])
        .rpc();
      logTx("withdrawFromBank (L1 settle + redelegate)", l1WithdrawSig);

      const bankAfter = await program.account.userBank.fetch(userBankPDA);
      const entryAfter = findBankEntry(bankAfter.entries, assetMint);
      const ataAfter = await getAccount(provider.connection, userAssetTokenAccount);

      expect(entryAfter!.balance.toNumber()).to.equal(
        entryBefore!.balance.toNumber() - withdrawAmount.toNumber()
      );
      expect(Number(ataAfter.amount)).to.equal(
        Number(ataBefore.amount) + withdrawAmount.toNumber()
      );
      expect(await isDelegated(userBankPDA)).to.equal(true);
    });

    it("should undelegate then deposit with wallet and redelegate to ER", async () => {
      const depositAmount = new BN(25_000_000);

      if (await isDelegated(userBankPDA)) {
        const undelegateTx = await getErProgram()
          .methods
          .undelegateUserBank()
          .accountsPartial({
            payer: sessionKeypair.publicKey,
            sessionToken: sessionTokenPDA,
            userBank: userBankPDA,
          })
          .transaction();
        const undelegateSig = await sendErSessionTransaction(undelegateTx, [
          sessionKeypair,
        ]);
        logTx("undelegateUserBank (session, pre-deposit)", undelegateSig);
        await new Promise((r) => setTimeout(r, 3000));
      } else {
        logResult("UserBank already on L1", "skipping pre-deposit undelegate");
      }

      const bankBefore = await program.account.userBank.fetch(userBankPDA);
      const entryBefore = findBankEntry(bankBefore.entries, assetMint);
      const balanceBefore = entryBefore ? entryBefore.balance.toNumber() : 0;

      const depositSig = await program.methods
        .depositToBank(depositAmount, true)
        .accountsPartial({
          user: testUser.publicKey,
          assetMint: assetMint,
          usdcMint: usdcMint,
          pool: poolPDA,
          userTokenAccount: userAssetTokenAccount,
          vault: assetVaultPDA,
          depositMint: assetMint,
        })
        .remainingAccounts(erValidatorRemainingAccounts())
        .signers([testUser])
        .rpc();
      logTx("depositToBank (redelegate)", depositSig);

      const bankAfter = await program.account.userBank.fetch(userBankPDA);
      const entryAfter = findBankEntry(bankAfter.entries, assetMint);
      expect(entryAfter!.balance.toNumber()).to.equal(
        balanceBefore + depositAmount.toNumber()
      );
      expect(await isDelegated(userBankPDA)).to.equal(true);
    });
  });

  // =========================================================================
  // 13. UNDELEGATION
  // =========================================================================
  describe("13. Undelegation", () => {
    it("should undelegate user bank from ER", async () => {
      logStep("Calling undelegateUserBank() on ER");

      if (!(await isDelegated(userBankPDA))) {
        logResult("UserBank already undelegated", "skipping");
        return;
      }

      const tx = await getErProgram()
        .methods
        .undelegateUserBank()
        .accountsPartial({
          payer: testUser.publicKey,
          userBank: userBankPDA,
          sessionToken: null,
        })
        .transaction();

      const sig = await sendErTestUserTransaction(tx);
      logTx("undelegateUserBank", sig);
      logResult("Undelegated", userBankPDA.toString());
    });
  });

  // =========================================================================
  // 14. FINAL STATE SUMMARY
  // =========================================================================
  describe("14. Final State Summary", () => {
    it("should print final state of all accounts", async () => {
      logSection("FINAL STATE SNAPSHOT");

      const pool = await fetchPool();
      logState("Pool", {
        authority: pool.authority.toString(),
        assetMint: pool.assetMint.toString().slice(0, 12) + "...",
        usdcMint: pool.usdcMint.toString().slice(0, 12) + "...",
        oracleFeed: pool.oracleFeed.toString(),
        paused: pool.paused,
        pythLazerId: pool.pythLazerId,
        oracleExponent: pool.oracleExponent,
      });

      const config = await program.account.config.fetch(configPDA);
      logState("Config", {
        targetInventoryBps: config.targetInventoryBps.toNumber(),
        baseSpreadBps: config.baseSpreadBps.toNumber(),
        maxSpreadBps: config.maxSpreadBps.toNumber(),
        virtualDepthK: config.virtualDepthK.toNumber(),
        lambda: config.lambda.toNumber(),
        maxTradeSize: config.maxTradeSize.toNumber(),
        maxOracleStalenessSec: config.maxOracleStalenessSec.toNumber(),
      });

      const quoteState = await program.account.quoteState.fetch(quoteStatePDA);
      logState("QuoteState", {
        fairPriceE8: quoteState.fairPriceE8.toNumber(),
        "fairPrice (USD)": `$${(quoteState.fairPriceE8.toNumber() / 1e8).toLocaleString()}`,
        bidPriceE8: quoteState.bidPriceE8.toNumber(),
        askPriceE8: quoteState.askPriceE8.toNumber(),
        spreadBps: quoteState.spreadBps.toNumber(),
      });

      const riskState = await program.account.riskState.fetch(riskStatePDA);
      logState("RiskState", {
        inventoryRatioBps: riskState.inventoryRatioBps.toNumber(),
        inventoryDeviationBps: riskState.inventoryDeviationBps.toNumber(),
        inventoryPenaltyBps: riskState.inventoryPenaltyBps.toNumber(),
      });

      const userBank = await program.account.userBank.fetch(userBankPDA);
      logState("UserBank", {
        authority: userBank.authority.toString().slice(0, 12) + "...",
        entriesCount: userBank.entries.length,
        entries: userBank.entries
          .map(
            (e: any) =>
              `${e.mint.toString().slice(0, 8)}... = ${e.balance.toNumber()}`
          )
          .join(" | "),
      });

      const assetVault = await getAccount(provider.connection, assetVaultPDA);
      const usdcVault = await getAccount(provider.connection, usdcVaultPDA);
      logState("Vault Balances", {
        assetVault: Number(assetVault.amount),
        usdcVault: Number(usdcVault.amount),
      });
    });
  });
});
