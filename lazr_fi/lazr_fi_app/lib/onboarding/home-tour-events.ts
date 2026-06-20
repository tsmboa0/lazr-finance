export const HOME_FAUCET_MINTED_EVENT = "lazr-tour:home-faucet-minted";

export type HomeFaucetMintedDetail = {
  symbol: string;
};

export const HOME_DEPOSIT_COMPLETED_EVENT = "lazr-tour:home-deposit-completed";

export type HomeDepositCompletedDetail = {
  symbol: string;
  kind: "deposit";
  venue: "propamm";
};

export const HOME_TOUR_OPEN_DEPOSIT_MENU_EVENT =
  "lazr-tour:open-deposit-menu";

export type HomeTourAction = "faucet-usdc" | "deposit-usdc";
