# Lazr PropAMM - Proprietary AMM on MagicBlock Ephemeral Rollup

A production-ready proprietary Automated Market Maker (propAMM) running entirely inside a MagicBlock Ephemeral Rollup with Pyth Lazer price feeds and native crank execution.

## Architecture

```
Pyth Lazer Feed (50-200ms updates)
         ↓
MagicBlock Native Crank (ScheduleTask)
         ↓
    Risk Engine (inventory + volatility)
         ↓
    Quote Engine (bid/ask generation)
         ↓
Virtual Liquidity Curve (XYK pricing)
         ↓
    Swap Execution (UserBank debits/credits)
```

### Key Differentiators

- **NOT a traditional XYK AMM** - This is a market maker exposing swap functionality
- **Inventory-aware pricing** - Cubic penalty function encourages portfolio rebalancing
- **Volatility-aware spreads** - Realized vol from rolling price window widens spreads
- **Pyth Lazer integration** - Sub-100ms price updates inside the Ephemeral Rollup
- **Zero-latency execution** - Crank + swaps run on MagicBlock ER (~10ms block times)
- **Delegated state** - All mutable state lives on ER during active trading

## Program Structure

```
programs/lazr_prop_amm/src/
├── lib.rs              # Entry point, #[ephemeral] program macro
├── constants.rs        # Seeds, defaults, precision constants
├── error.rs            # All error codes
├── state/              # Account definitions (all #[derive(InitSpace)])
│   ├── pool.rs         # Pool (per trading pair)
│   ├── config.rs       # Config parameters
│   ├── quote_state.rs  # Live bid/ask quotes
│   ├── risk_state.rs   # Inventory & volatility metrics
│   ├── volatility_state.rs # Rolling price circular buffer
│   ├── hedge_state.rs  # Hedge signal flags
│   ├── user_bank.rs    # Per-user token balances (20 slots)
│   └── swap_order.rs   # Swap intent + execution record
├── instructions/       # All instruction handlers
│   ├── admin/          # init_admin, init_pool, update_config, pause, resume
│   ├── delegation/     # delegate_pool (5 accounts at once)
│   ├── crank/          # setup_crank (ScheduleTask), process_crank_tick
│   ├── liquidity/      # deposit, withdraw (SPL token transfers)
│   └── user/           # user_bank, swap_order, swap execution
├── math/               # Fixed-point arithmetic (no floats)
│   ├── fixed_point.rs  # e8 precision helpers
│   ├── sqrt.rs         # Integer square root
│   ├── inventory.rs    # Ratio, deviation, cubic penalty
│   ├── spread.rs       # Spread engine + bid/ask
│   ├── swap.rs         # Virtual liquidity curve
│   └── volatility.rs   # Realized vol from log returns
└── oracle/             # Pyth Lazer reader
    └── pyth_lazer.rs   # Raw byte parsing at offset 73
```

## Supported Trading Pairs

Initial 20 tokens from Pyth Lazer (all paired with USDC):

| ID | Asset | Update Rate | Exponent |
|----|-------|-------------|----------|
| 1 | BTC/USD | 50ms | -8 |
| 2 | ETH/USD | 50ms | -8 |
| 3 | PYTH/USD | 50ms | -8 |
| 4 | PEPE/USD | 50ms | -10 |
| 5 | NEIRO/USD | 50ms | -10 |
| 6 | SOL/USD | 50ms | -8 |
| 9 | BONK/USD | 200ms | -10 |
| 10 | WIF/USD | 200ms | -8 |
| 11 | SUI/USD | 200ms | -8 |
| 12 | TON/USD | 200ms | -8 |
| 13 | DOGE/USD | 200ms | -8 |
| 14 | XRP/USD | 200ms | -8 |
| 15 | BNB/USD | 200ms | -8 |
| 16 | ADA/USD | 200ms | -8 |
| 17 | TRX/USD | 200ms | -8 |
| 18 | AVAX/USD | 200ms | -8 |
| 19 | LINK/USD | 200ms | -8 |
| 20 | SHIB/USD | 200ms | -10 |

Oracle PDA derivation: `seeds = ["price_feed", "pyth-lazer", feed_id_string]` under program `PriCems5tHihc6UDXDjzjeawomAwBduWMGAi8ZUjppd`

## Mathematics

### Inventory Ratio (BPS)

```
asset_value = Q_asset × P_fair
total_value = asset_value + Q_usdc
inventory_ratio = (asset_value / total_value) × 10000
```

### Cubic Penalty (BPS)

```
deviation = inventory_ratio - target_inventory
penalty = λ × deviation³ / 10000²
```

Small deviations produce tiny changes. Large deviations produce aggressive adjustments.

### Spread Calculation

```
spread = base_spread + |inventory_penalty| + (volatility / 2)
spread = min(spread, max_spread)
```

### Bid/Ask Generation

```
bid = fair_price × (1 - (half_spread + penalty) / 10000)
ask = fair_price × (1 + (half_spread - penalty) / 10000)
```

When inventory is heavy on asset: bid drops aggressively, ask stays attractive.
When inventory is light on asset: bid rises, ask rises.

### Virtual Liquidity Curve

```
Vx = K / sqrt(P)    (virtual asset reserve)
Vy = K × sqrt(P)    (virtual USDC reserve)
```

### Swap Output (Asset → USDC)

```
delta_y = Vy - (Vx × Vy) / (Vx + delta_x)
net_output = delta_y × (1 - spread_bps / 10000)
```

## Instruction Flow

### Setup (Base Layer)

```
1. initialize_admin()
2. initialize_pool()     → creates Pool + Config + QuoteState + RiskState + VolatilityState + HedgeState + Vaults
```

### Delegation (Base Layer → ER)

```
3. delegate_pool()       → delegates all pool state to Ephemeral Rollup
4. setup_crank()         → schedules process_crank_tick via MagicBlock ScheduleTask (on ER)
```

### User Trading (ER)

```
5. init_user_bank()      → per-user balance ledger (base layer)
6. deposit_liquidity()   → SPL transfer to vault + UserBank credit (base layer)
7. delegate_user_bank()  → delegate UserBank to ER
8. create_swap_order()   → create + delegate swap order
9. swap_asset_for_usdc() / swap_usdc_for_asset()  → execute on ER
10. undelegate_swap_order()
11. undelegate_user_bank()
12. withdraw_liquidity() → SPL transfer from vault (base layer)
```

## Security

- Pause switch (admin circuit breaker)
- Stale oracle protection (configurable max age)
- Stale quote protection (same check on swap execution)
- Max spread clamp
- Max trade size enforcement
- Checked arithmetic everywhere (no `unwrap()`, no floats)
- Vault solvency validation before withdrawals
- Authority validation on all admin ops
- Hedge signaling (soft 70% / hard 85% limits)

## Development

### Prerequisites

- Rust 1.89+
- Anchor CLI 1.0.2
- Solana CLI 2.x
- Node.js 18+

### Build

```bash
anchor build
```

### Test (local)

```bash
anchor test
```

### Test (with ER)

```bash
EPHEMERAL_PROVIDER_ENDPOINT=https://devnet-as.magicblock.app/ anchor test
```

## Dependencies

| Crate | Version | Purpose |
|-------|---------|---------|
| anchor-lang | 1.0.2 | Anchor framework |
| anchor-spl | 1.0.2 | SPL token CPI |
| ephemeral-rollups-sdk | 0.14.4 | Delegation, commit, ephemeral macros |
| magicblock-magic-program-api | 0.10.1 | ScheduleTask crank CPI |
| bincode | 1.3 | Serialization for crank instruction |

## License

ISC
