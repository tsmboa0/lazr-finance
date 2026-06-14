import { PublicKey, Transaction, type Connection } from "@solana/web3.js";
import type { PropAmmWallet } from "./wallet";
import { getPoolForSymbol } from "../devnet-config";
import { toRawAmount } from "./amounts";
import { logError, logStep } from "./debug";
import {
  getDelegationStatus,
  requireErEndpoint,
} from "./delegation";
import { userBankPda } from "./pdas";
import { getErProgram } from "./program";
import {
  buildCreateSessionInstructions,
  getOrCreateSessionKeypair,
} from "./session";
import {
  assertSessionFundedOnEr,
  sendErSessionTransaction,
  sendWalletTransaction,
} from "./transactions";

export interface SwapParams {
  /** Pool asset symbol (e.g. BTC on the BTC trade page). */
  assetSymbol: string;
  /** Ticker of the token being sold (USDC or asset). */
  sellSymbol: string;
  amountIn: number;
  /** Minimum output in buy-token human units (slippage guard). */
  minAmountOut: number;
  user: PublicKey;
  connection: Connection;
  wallet: PropAmmWallet;
  signTransaction: (tx: Transaction) => Promise<Transaction>;
}

export async function executeSwap(
  params: SwapParams
): Promise<{ signature: string }> {
  const {
    assetSymbol,
    sellSymbol,
    amountIn,
    minAmountOut,
    user,
    connection,
    wallet,
    signTransaction,
  } = params;

  logStep("swap", "Starting swap", {
    assetSymbol,
    sellSymbol,
    amountIn,
    minAmountOut,
    user: user.toBase58(),
  });

  try {
    const pool = getPoolForSymbol(assetSymbol);
    const sellingUsdc = sellSymbol.toUpperCase() === "USDC";
    const sellDecimals = sellingUsdc
      ? pool.usdcDecimals
      : pool.decimals;
    const buyDecimals = sellingUsdc
      ? pool.decimals
      : pool.usdcDecimals;

    const rawAmountIn = toRawAmount(amountIn, sellDecimals);
    const rawMinOut = toRawAmount(minAmountOut, buyDecimals);

    if (rawAmountIn.isZero()) {
      throw new Error("Swap amount must be greater than zero.");
    }

    const userBank = userBankPda(user);
    const delegation = await getDelegationStatus(userBank);

    if (!delegation.isDelegated) {
      throw new Error(
        "Bank not on ER. Deposit funds first, then swap."
      );
    }

    const erEndpoint = requireErEndpoint(delegation);
    const sessionKeypair = getOrCreateSessionKeypair(user);

    const { instructions: sessionIxs, sessionToken } =
      await buildCreateSessionInstructions(
        wallet,
        connection,
        user,
        sessionKeypair
      );

    if (sessionIxs.length > 0) {
      logStep("swap", "Creating session on L1");
      const sessionTx = new Transaction().add(...sessionIxs);
      await sendWalletTransaction(
        connection,
        wallet,
        signTransaction,
        sessionTx,
        [sessionKeypair],
        400_000,
        "swap create session"
      );
    }

    await assertSessionFundedOnEr(sessionKeypair, erEndpoint);

    const programEr = getErProgram(wallet, erEndpoint);
    const swapAccounts = {
      payer: sessionKeypair.publicKey,
      sessionToken,
      userBank,
      pool: new PublicKey(pool.pool),
      assetMint: new PublicKey(pool.assetMint),
      usdcMint: new PublicKey(pool.usdcMint),
      config: new PublicKey(pool.config),
      quoteState: new PublicKey(pool.quoteState),
    };

    const swapArgs = {
      amountIn: rawAmountIn,
      minAmountOut: rawMinOut,
    };

    logStep("swap", sellingUsdc ? "USDC → asset" : "asset → USDC", {
      erEndpoint,
      pool: pool.pool,
      rawAmountIn: rawAmountIn.toString(),
      rawMinOut: rawMinOut.toString(),
    });

    const swapIx = sellingUsdc
      ? await programEr.methods
          .swapUsdcForAsset(swapArgs)
          .accountsPartial(swapAccounts)
          .instruction()
      : await programEr.methods
          .swapAssetForUsdc(swapArgs)
          .accountsPartial(swapAccounts)
          .instruction();

    const swapTx = new Transaction().add(swapIx);
    const signature = await sendErSessionTransaction(
      swapTx,
      sessionKeypair,
      erEndpoint,
      400_000,
      sellingUsdc ? "swap buy" : "swap sell"
    );

    logStep("swap", "Swap complete", { signature });
    return { signature };
  } catch (error) {
    logError("swap", "executeSwap", error);
    throw error;
  }
}
