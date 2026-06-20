import type { HomeTourAction } from "./home-tour-events";

export type HomeTourStep = {
  id: string;
  target: string;
  title: string;
  body: string;
  /** When true, the tour waits for wallet connection before showing Next. */
  waitForWallet?: boolean;
  /** When true, the user must click the highlighted target to advance. */
  waitForTargetClick?: boolean;
  /** When true, advance once Flash Trade perps is enabled (basket exists). */
  waitForPerpsEnabled?: boolean;
  /** Multi-step action the user must complete before advancing. */
  waitForAction?: HomeTourAction;
  /** Hint shown while waiting for a target click or action. */
  actionHint?: string;
  /** Preferred tooltip placement relative to the spotlight. */
  placement?: "bottom" | "top" | "left" | "right";
};

export const HOME_TOUR_STEPS: HomeTourStep[] = [
  {
    id: "connect",
    target: "connect-wallet",
    title: "Connect your wallet",
    body: "Click Connect to link your Solana wallet. You'll need it for faucets, deposits, and trading.",
    waitForWallet: true,
    placement: "bottom",
  },
  {
    id: "faucet",
    target: "faucet",
    title: "Mint dummy test tokens",
    body: "PropAMM only works with Lazr’s dummy faucets for now—not official devnet USDC, which is too limited. Mint test USDC here to try spot trading.",
    waitForAction: "faucet-usdc",
    actionHint: "Click the pulsing Faucet button above to mint dummy USDC for PropAMM.",
    placement: "bottom",
  },
  {
    id: "deposit",
    target: "deposit",
    title: "Deposit to your bank",
    body: "Open the wallet menu, choose Deposit, and move USDC from your wallet into your PropAMM bank.",
    waitForAction: "deposit-usdc",
    actionHint: "Click the pulsing wallet icon above to deposit USDC into your PropAMM bank.",
    placement: "bottom",
  },
  {
    id: "tokens",
    target: "tokens",
    title: "Pick a market",
    body: "Click any token / USDC pair below to open the spot trading terminal and start swapping.",
    placement: "top",
  },
];
