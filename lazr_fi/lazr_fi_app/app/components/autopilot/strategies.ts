export type StrategyId = "conservative" | "balanced" | "aggressive";

export interface AutopilotStrategy {
  id: StrategyId;
  label: string;
  description: string;
  monthlyPnlPct: number;
  annualPnlPct: number;
  winRate: number;
  maxDrawdown: number;
  tradesPerDay: number;
  riskLabel: string;
  riskTone: "low" | "medium" | "high";
  suggestedLeverage?: number;
}

export const AUTOPILOT_STRATEGIES: AutopilotStrategy[] = [
  {
    id: "conservative",
    label: "Conservative",
    description: "Tight ranges, smaller size, priority on capital preservation.",
    monthlyPnlPct: 4.2,
    annualPnlPct: 50.4,
    winRate: 68,
    maxDrawdown: 6.5,
    tradesPerDay: 2,
    riskLabel: "Low risk",
    riskTone: "low",
    suggestedLeverage: 3,
  },
  {
    id: "balanced",
    label: "Balanced",
    description: "Mix of momentum and mean-reversion with moderate exposure.",
    monthlyPnlPct: 8.5,
    annualPnlPct: 102,
    winRate: 58,
    maxDrawdown: 12,
    tradesPerDay: 5,
    riskLabel: "Medium risk",
    riskTone: "medium",
    suggestedLeverage: 8,
  },
  {
    id: "aggressive",
    label: "Aggressive",
    description: "Higher frequency, wider targets, accepts deeper swings.",
    monthlyPnlPct: 15.8,
    annualPnlPct: 189.6,
    winRate: 52,
    maxDrawdown: 22,
    tradesPerDay: 12,
    riskLabel: "High risk",
    riskTone: "high",
    suggestedLeverage: 20,
  },
];
