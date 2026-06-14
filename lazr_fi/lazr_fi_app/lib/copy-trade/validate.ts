import { PublicKey } from "@solana/web3.js";

export function isValidLeaderAddress(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  try {
    const pk = new PublicKey(trimmed);
    return PublicKey.isOnCurve(pk.toBytes());
  } catch {
    return false;
  }
}

export function truncateAddress(address: string, chars = 4): string {
  if (address.length <= chars * 2 + 1) return address;
  return `${address.slice(0, chars)}…${address.slice(-chars)}`;
}
