import { AnchorProvider, Program, type Idl } from "@coral-xyz/anchor";
import { Connection } from "@solana/web3.js";
import idl from "./idl.json";
import { PROGRAM_ID, ER_ENDPOINT, ER_WS_ENDPOINT } from "./constants";
import type { PropAmmWallet } from "./wallet";

export type LazrPropAmm = Idl;

export function getL1Program(connection: Connection, wallet: PropAmmWallet): Program {
  const provider = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
    preflightCommitment: "confirmed",
  });
  return new Program(idl as LazrPropAmm, provider);
}

export function getErConnection(endpoint: string = ER_ENDPOINT): Connection {
  return new Connection(endpoint, {
    wsEndpoint: ER_WS_ENDPOINT,
    commitment: "confirmed",
  });
}

export function getErProgram(
  wallet: PropAmmWallet,
  endpoint: string = ER_ENDPOINT
): Program {
  const connection = getErConnection(endpoint);
  const provider = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
    preflightCommitment: "confirmed",
  });
  return new Program(idl as LazrPropAmm, provider);
}

export { PROGRAM_ID };
