import type { HomeTourStep } from "./home-tour-steps";

const SETUP_STEP: HomeTourStep = {
  id: "setup",
  target: "perps-setup",
  title: "Register on Flash Trade",
  body: "Enable one-click perps by registering your wallet on Flash Trade v2. This is a one-time mainnet setup — no USDC moves until you deposit.",
  waitForTargetClick: true,
  waitForPerpsEnabled: true,
  actionHint: "Click Enable Perps to register, then approve in your wallet.",
  placement: "bottom",
};

const CORE_STEPS: HomeTourStep[] = [
  {
    id: "deposit",
    target: "deposit",
    title: "Deposit USDC margin",
    body: "Deposit real mainnet USDC into your Flash Trade ledger via Portfolio → Perps. You need margin in your ledger before opening positions.",
    placement: "bottom",
  },
  {
    id: "positions",
    target: "perps-positions",
    title: "Manage positions",
    body: "Track open positions, orders, and history here. Close individual positions or manage your exposure from this panel.",
    placement: "top",
  },
  {
    id: "trade",
    target: "perps-trade",
    title: "Place a perp trade",
    body: "Choose long or short, set collateral and leverage, then open a market or limit perp position against Flash Trade.",
    placement: "left",
  },
  {
    id: "autopilot-tab",
    target: "perps-autopilot-tab",
    title: "Open Autopilot",
    body: "Click Autopilot to set up a bot that trades perps automatically on your behalf.",
    waitForTargetClick: true,
    actionHint: "Click Autopilot in the highlight above to continue.",
    placement: "left",
  },
  {
    id: "autopilot-panel",
    target: "perps-autopilot-panel",
    title: "Perps Autopilot",
    body: "Follow a curated leader or configure copy-trading to automate your perp strategy.",
    placement: "left",
  },
  {
    id: "coming-soon",
    target: "perps-coming-soon",
    title: "More coming soon",
    body: "Predict, Lend, and Portfolio are on the roadmap — more Lazr Finance products landing soon.",
    placement: "bottom",
  },
];

export function buildPerpsTourSteps(args: {
  isRegistered: boolean;
  connected: boolean;
}): HomeTourStep[] {
  const steps = [...CORE_STEPS];
  if (!args.isRegistered && args.connected) {
    return [SETUP_STEP, ...steps];
  }
  return steps;
}

export const PERPS_ENABLE_SHEET_EVENT = "lazr-perps-enable-sheet";

export type PerpsEnableSheetDetail = {
  open: boolean;
};

export const PERPS_TRADE_TAB_EVENT = "lazr-tour:perps-trade-tab";

export type PerpsTradeTabDetail = {
  tab: "market" | "limit" | "autopilot";
};
