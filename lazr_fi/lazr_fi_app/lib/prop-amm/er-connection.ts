import { Connection } from "@solana/web3.js";
import { ER_ENDPOINT, ER_WS_ENDPOINT } from "./constants";

export function getErSubscriptionConnection(): Connection {
  return new Connection(ER_ENDPOINT, {
    wsEndpoint: ER_WS_ENDPOINT,
    commitment: "confirmed",
  });
}
