# MacroIndicators — 宏观周期指标

A comprehensive macro cycle indicator panel for **Wall Street Raider**, inspired by Bridgewater Associates' All-Weather framework. Adds a **📊 Macro Indicators** button next to the Cheats button in the in-game toolbar.

---

## Features

### Key Rates Dashboard (3×3 Grid)
Live display of Prime Rate, GDP Growth, Long Bond (10Y), Short Bond (2Y), Curve Spread, Carry Trade Space, Individual Tax Rate, Capital Gains Tax Rate, and After-Tax Carry — each with formula breakdown.

### Yield Curve Analysis
- 10Y−2Y spread (inversion depth & duration)
- Curve direction (steepening / flattening)
- Re-steepening velocity (annualized rate of change)

### Growth & Credit Monitor
- Growth-Yield Differential (GDP − Bond Yield, as ERP proxy)
- Sahm Rule recession signal (GDP-based approximation)
- Credit Stress (Prime − Risk-Free spread)

### 4-Stage Cycle Phase Detector
Visual phase bar: Easing → Recovery → Tightening → Pre-Recession. Detected from rate direction + curve movement + GDP trend using quarterly historical snapshots.

### Central Bank Monetary Policy
Parsed from the in-game Advisory Summary text. Classifies stance: AGGRESSIVE EASING / EASING / NEUTRAL / TIGHTENING. Cross-referenced with cycle phase to flag divergences.

### Tax-Aware Analysis
Corporate, individual, and capital gains tax rates extracted from Economic Data. Computes after-tax bond yields, after-tax carry trade spread, capital gains tax advantage, and tax-efficiency tags ([CG]/[OI]) per asset class.

### Asset Class Signals (10 Assets)
Macro-driven BUY / SELL / HOLD signals for: Stock Index, Gold, Silver, Oil, Corn, Wheat, Bitcoin, Ethereum, Long Bond (10Y), Short Bond (2Y). Each signal includes rationale and current price with % change.

### Strategic Recommendation
Composite OVERWEIGHT / AVOID picks from all indicators, with cycle-phase context.

### Arbitrage Playbook
Cycle-stage strategy guide (Easing, Recovery, Tightening, Pre-Recession), with the current phase highlighted.

### Historical Tracking
Quarterly macro snapshots auto-saved to your game file. Supports trend-based indicators (curve direction, velocity, inversion duration, cycle detection). Auto-backfills from the game's built-in chart history when first opened.

### Bilingual Support
Full English and Simplified Chinese. Automatically follows the game's language setting.

---

## Data Sources

Some indicators require data that the game engine only broadcasts while specific views are open. **Data is cached after first load** and persists across view switches until the game is restarted.

| Data | In-Game View | Cached |
|------|-------------|--------|
| Tax Rates (Corp/Indiv/CG) | Market → Industries → Economic Data | Yes |
| Monetary Policy | Market → Industries → Advisory Summary (or company Overview) | Yes |
| Bond Yields / Prime / GDP | Always available (allSecurities) | N/A |
| Commodity & Crypto Prices | Always available (allSecurities) | N/A |

**First-time workflow:**
1. Open Market → Industries view
2. Click the Economic Data tab (loads tax rates)
3. View the Advisory Summary panel (loads monetary policy)
4. Click 📊 Macro Indicators — all data populates
5. Navigate anywhere — data persists

---

## Installation

**Steam Workshop:** Subscribe and restart the game.

**Manual:** Copy `resources/` into `<install>/resources/`, maintaining the folder structure. Restart.

**Files:**
- `resources/app/js/components/MacroIndicatorPanel.js` (NEW)
- `resources/app/js/components/Toolbar.js` (REPLACEMENT — adds panel button)
- `resources/app/js/locale/macroIndicators-zh.js` (NEW)

---

## Notes

- Additive mod — minimal changes to Toolbar.js (one import + one button).
- Historical snapshots stored in save file's customData under the `macroHistory` key. No conflicts with other mods.
- All indicators computed from in-game data. Decision-support tool, not financial advice.
