import { FlashV2Error, type TradeType } from "flash-v2";
import { flash, COLLATERAL_SYMBOL } from "./client";
import type { ActiveSigner } from "./signer";

export interface OpenTradeParams {
  marketSymbol: string;
  collateralUsd: string;
  leverage: number;
  side: TradeType;
  orderType?: "MARKET" | "LIMIT";
  limitPrice?: string;
  takeProfit?: string;
  stopLoss?: string;
  slippagePercentage?: string;
}

export interface CloseTradeParams {
  marketSymbol: string;
  side: TradeType;
  /** "0" = full close */
  inputUsdUi?: string;
}

export function tradeErrorMessage(e: unknown): string {
  if (e instanceof FlashV2Error) return e.message;
  const raw = e instanceof Error ? e.message : String(e);
  if (/Failed to fetch|502 Bad Gateway/i.test(raw)) {
    return "Can't reach Flash Trade right now — nothing was submitted.";
  }
  if (/429|Too Many Requests/i.test(raw)) {
    return "Rate limited — retry in a moment.";
  }
  if (/reject|declin|cancel/i.test(raw)) {
    return "Approval declined in wallet.";
  }
  return raw;
}

export async function executeOpenPosition(
  signer: ActiveSigner,
  params: OpenTradeParams
): Promise<{ ok: boolean; signature?: string; error?: string }> {
  try {
    const quote = await flash.openPosition({
      inputTokenSymbol: COLLATERAL_SYMBOL,
      outputTokenSymbol: params.marketSymbol,
      inputAmountUi: params.collateralUsd,
      leverage: params.leverage,
      tradeType: params.side,
      orderType: params.orderType ?? "MARKET",
      limitPrice: params.limitPrice,
      takeProfit: params.takeProfit,
      stopLoss: params.stopLoss,
      owner: signer.owner,
      slippagePercentage: params.slippagePercentage ?? "0.5",
      ...signer.tradeFields,
    });
    if (quote.err) {
      throw new FlashV2Error({
        channel: "body-err",
        endpoint: "openPosition",
        message: quote.err,
        status: 200,
      });
    }
    if (!quote.transactionBase64) {
      throw new Error("API returned a quote but no transaction");
    }
    const { signature } = await signer.sendTrade(quote.transactionBase64);
    return { ok: true, signature };
  } catch (e) {
    return { ok: false, error: tradeErrorMessage(e) };
  }
}

export async function executeClosePosition(
  signer: ActiveSigner,
  params: CloseTradeParams
): Promise<{ ok: boolean; signature?: string; error?: string }> {
  try {
    const close = await flash.closePosition({
      marketSymbol: params.marketSymbol,
      side: params.side,
      inputUsdUi: params.inputUsdUi ?? "0",
      withdrawTokenSymbol: COLLATERAL_SYMBOL,
      owner: signer.owner,
      slippagePercentage: "0.5",
      ...signer.tradeFields,
    });
    if (close.err) {
      throw new FlashV2Error({
        channel: "body-err",
        endpoint: "closePosition",
        message: close.err,
        status: 200,
      });
    }
    if (!close.transactionBase64) {
      throw new Error("Close returned no transaction");
    }
    const { signature } = await signer.sendTrade(close.transactionBase64);
    return { ok: true, signature };
  } catch (e) {
    return { ok: false, error: tradeErrorMessage(e) };
  }
}

/** Preview-only quote (no owner) for fees/liq display. */
export async function previewOpenPosition(params: {
  marketSymbol: string;
  collateralUsd: string;
  leverage: number;
  side: TradeType;
  orderType?: "MARKET" | "LIMIT";
  limitPrice?: string;
}) {
  return flash.openPosition({
    inputTokenSymbol: COLLATERAL_SYMBOL,
    outputTokenSymbol: params.marketSymbol,
    inputAmountUi: params.collateralUsd,
    leverage: params.leverage,
    tradeType: params.side,
    orderType: params.orderType ?? "MARKET",
    limitPrice: params.limitPrice,
  });
}
