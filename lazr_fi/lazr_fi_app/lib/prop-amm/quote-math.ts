const E8 = BigInt(100_000_000);
const BPS = BigInt(10_000);

function isqrt(n: bigint): bigint {
  if (n <= BigInt(1)) return n;
  let x = n;
  let y = (x + BigInt(1)) / BigInt(2);
  while (y < x) {
    x = y;
    y = (x + n / x) / BigInt(2);
  }
  return x;
}

function isqrtE8(valE8: bigint): bigint {
  return isqrt(valE8 * E8);
}

export function computeVirtualReservesE8(
  executablePriceE8: bigint,
  virtualDepthK: bigint,
  assetDecimals: number,
  usdcDecimals: number
): [bigint, bigint] | null {
  if (executablePriceE8 <= BigInt(0)) return null;
  const sqrtPrice = isqrtE8(executablePriceE8);
  if (sqrtPrice <= BigInt(0)) return null;
  let vy = (virtualDepthK * sqrtPrice) / E8;
  let vx = (virtualDepthK * E8) / sqrtPrice;
  if (vx <= BigInt(0) || vy <= BigInt(0)) return null;

  const decDiff = usdcDecimals - assetDecimals;
  if (decDiff > 0) {
    vy *= BigInt(10 ** decDiff);
  } else if (decDiff < 0) {
    vx *= BigInt(10 ** -decDiff);
  }

  return [vx, vy];
}

function applySpread(grossOutput: bigint, spreadBps: bigint): bigint {
  if (grossOutput <= BigInt(0)) return BigInt(0);
  const spreadDeduction = (grossOutput * spreadBps) / BPS;
  const net = grossOutput - spreadDeduction;
  return net > BigInt(0) ? net : BigInt(0);
}

/** USDC (vy side) in → asset (vx side) out. Amounts in raw token units. */
export function computeSwapUsdcForAsset(
  amountIn: bigint,
  vx: bigint,
  vy: bigint,
  spreadBps: bigint
): bigint {
  if (amountIn <= BigInt(0)) return BigInt(0);
  const newVy = vy + amountIn;
  const k = vx * vy;
  const newVx = k / newVy;
  const grossOutput = vx - newVx;
  return applySpread(grossOutput, spreadBps);
}

/** Asset (vx side) in → USDC (vy side) out. Amounts in raw token units. */
export function computeSwapAssetForUsdc(
  amountIn: bigint,
  vx: bigint,
  vy: bigint,
  spreadBps: bigint
): bigint {
  if (amountIn <= BigInt(0)) return BigInt(0);
  const newVx = vx + amountIn;
  const k = vx * vy;
  const newVy = k / newVx;
  const grossOutput = vy - newVy;
  return applySpread(grossOutput, spreadBps);
}

export function e8ToUsd(priceE8: bigint): number {
  return Number(priceE8) / Number(E8);
}

export function rawToHuman(raw: bigint, decimals: number): number {
  const str = raw.toString().padStart(decimals + 1, "0");
  const whole = str.slice(0, -decimals) || "0";
  const fraction = str.slice(-decimals);
  return Number(`${whole}.${fraction}`);
}

export function humanToRaw(amount: number, decimals: number): bigint {
  if (!Number.isFinite(amount) || amount <= 0) return BigInt(0);
  const [wholePart, fractionPart = ""] = amount.toString().split(".");
  const fraction = fractionPart.padEnd(decimals, "0").slice(0, decimals);
  const raw = `${wholePart}${fraction}`.replace(/^0+(?=\d)/, "");
  return BigInt(raw || "0");
}
