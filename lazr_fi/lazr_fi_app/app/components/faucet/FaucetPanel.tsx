import FaucetClaimForm from "./FaucetClaimForm";
import { Droplets } from "lucide-react";

export default function FaucetPanel() {
  return (
    <div className="w-full max-w-md rounded-2xl border border-border bg-background shadow-[0_24px_64px_rgba(0,0,0,0.35)]">
      <div className="p-6 border-b border-border-subtle">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold/10 border border-gold/20">
            <Droplets className="w-5 h-5 text-gold" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground tracking-tight">
              Test Faucet
            </h1>
            <p className="text-sm text-tertiary mt-1 leading-relaxed">
              Claim devnet test tokens to explore swaps, perps, and autopilot.
            </p>
          </div>
        </div>
      </div>
      <FaucetClaimForm variant="page" />
    </div>
  );
}
