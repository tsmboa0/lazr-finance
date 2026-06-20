/** Thrown when deposit/withdraw was cancelled after undelegate — bank stuck on L1. */
export class UserBankNeedsRedelegateError extends Error {
  constructor() {
    super(
      "Transaction cancelled after your bank moved to L1. Re-delegate to resume swapping."
    );
    this.name = "UserBankNeedsRedelegateError";
  }
}

export function isUserBankNeedsRedelegateError(
  error: unknown
): error is UserBankNeedsRedelegateError {
  return error instanceof UserBankNeedsRedelegateError;
}
