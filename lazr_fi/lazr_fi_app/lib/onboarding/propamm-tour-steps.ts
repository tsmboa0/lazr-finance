import type { HomeTourStep } from "./home-tour-steps";

export const PROPAMM_TOUR_STEPS: HomeTourStep[] = [
  {
    id: "er-quote",
    target: "propamm-er-quote",
    title: "Live ER quote",
    body: "This is the real-time ER quote from the PropAMM pool — your fair mid price, plus live bid, ask, and spread.",
    placement: "right",
  },
  {
    id: "positions",
    target: "propamm-positions",
    title: "Transaction history",
    body: "Your swaps, deposits, and withdrawals appear here with links to the Ephemeral Rollup (swaps) or devnet explorer (bank moves).",
    placement: "top",
  },
  {
    id: "swap",
    target: "propamm-swap",
    title: "Swap panel",
    body: "Use the swap panel to buy or sell against the pool. Enter an amount, review the quote, and hit Swap to execute a spot trade from your bank balance.",
    placement: "left",
  },
  {
    id: "autopilot-tab",
    target: "propamm-autopilot-tab",
    title: "Open Autopilot",
    body: "Autopilot helps you automate your swaps based on predefined strategies.",
    waitForTargetClick: true,
    actionHint: "Click Autopilot in the highlight above to continue.",
    placement: "left",
  },
  {
    id: "autopilot-panel",
    target: "propamm-autopilot",
    title: "Autopilot strategies",
    body: "Pick a strategy, set your capital, and let Lazr automate swaps — choose conservative, balanced, or aggressive profiles.",
    placement: "left",
  },
  {
    id: "perps-nav",
    target: "propamm-perps-nav",
    title: "Try perps next",
    body: "When you're ready, open the Perps tab to trade leveraged markets via Flash Trade after you've swapped on PropAMM spot.",
    placement: "bottom",
  },
];

export const PROPAMM_SWAP_TAB_EVENT = "lazr-tour:propamm-swap-tab";

export type PropAmmSwapTabDetail = {
  tab: "Market" | "Limit" | "Autopilot";
};
