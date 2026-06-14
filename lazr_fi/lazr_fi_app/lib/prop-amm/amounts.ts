import BN from "bn.js";

export function toRawAmount(amount: number, decimals: number): BN {
  if (!Number.isFinite(amount) || amount <= 0) {
    return new BN(0);
  }

  const [wholePart, fractionPart = ""] = amount.toString().split(".");
  const fraction = fractionPart.padEnd(decimals, "0").slice(0, decimals);
  const raw = `${wholePart}${fraction}`.replace(/^0+(?=\d)/, "");
  return new BN(raw || "0");
}

export function fromRawAmount(raw: BN, decimals: number): number {
  const str = raw.toString().padStart(decimals + 1, "0");
  const whole = str.slice(0, -decimals) || "0";
  const fraction = str.slice(-decimals);
  return Number(`${whole}.${fraction}`);
}
