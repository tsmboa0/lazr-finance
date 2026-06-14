export function hasInsufficientBalance(
  amount: number,
  balance: number | null,
  connected: boolean
): boolean {
  if (!connected || balance === null || amount <= 0) return false;
  return amount > balance;
}
