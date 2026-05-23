// Chinese translation dictionary for Macro Indicators mod (Enhanced Edition).
// All UI strings rendered by MacroIndicatorPanel.js have entries here.
// Pattern: t("English String") → Chinese equivalent when locale is zh-CN.

export const macroIndicatorsZH = {

    // ── Panel header ──
    "Macro Cycle Indicators": "宏观周期指标",
    "Bridgewater-style Four-Quadrant Analysis": "桥水风格四象限分析",
    "Close": "关闭",
    "Q": "Q",
    "—": "—",

    // ── Key Rates Dashboard ──
    "Key Rates Dashboard": "核心利率仪表盘",
    "Key Rates": "核心利率",
    "Prime Rate": "基准利率",
    "GDP Growth": "GDP 增长率",
    "GDP Growth Rate": "GDP增长率",
    "Long Bond (10Y)": "长期国债 (10年)",
    "Short Bond (2Y)": "短期国债 (2年)",
    "Long Bond Rate": "长期国债利率",
    "Short Bond Rate": "短期国债利率",
    "Curve Spread (10Y−2Y)": "曲线利差 (10年−2年)",
    "Carry Trade Space": "套息交易空间",

    // ── Section headers ──
    "Yield Curve Analysis": "收益率曲线分析",
    "Growth & Credit Monitor": "增长与信贷监控",
    "Four-Stage Cycle Phase Detector": "四阶段周期相位检测器",
    "Strategic Recommendation": "战略建议",
    "Arbitrage Playbook": "套利操作手册",
    "Historical Data": "历史数据",
    "Four Core Indicators": "四大核心指标",

    // ── Indicator 1: Yield Curve Spread ──
    "Yield Curve Spread (10Y − 2Y)": "收益率曲线利差 (10年 − 2年)",
    "Data Insufficient": "数据不足",
    "Open Market → Interest Rates report to populate bond yields.": "打开 市场 → 利率报告 以填充债券收益率数据。",
    "DEEPLY INVERTED — Recession Signal": "深度倒挂 — 衰退信号",
    "Mildly Inverted — Caution": "轻度倒挂 — 谨慎",
    "Flat Curve — Transition Zone": "平坦曲线 — 过渡区间",
    "Normal / Steep — Expansion": "正常/陡峭 — 扩张期",

    // ── Indicator 2: Growth-Yield Differential ──
    "Growth-Yield Differential": "增长-收益率差额",
    "Growth-Yield Differential (GDP Growth − Bond Yield)": "增长-收益率差额 (GDP增长 − 债券收益率)",
    "No GDP Growth Data": "无GDP增长数据",
    "View Economic Data report to populate GDP rate.": "查看 经济数据 报告以获取GDP增长率。",
    "No Bond Yield Data": "无债券收益率数据",
    "Need Long Bond Rate or Prime Rate for the yield comparison.": "需要长期国债利率或基准利率进行收益率比较。",
    "Bonds DOMINATE — Risk-Free Yield Far Exceeds Growth": "债券为王 — 无风险收益远超经济增长",
    "Bonds Favored — Yield Premium Over Growth": "债券占优 — 收益率溢价超过增长",
    "Balanced — Growth ≈ Bond Yield": "均衡 — 增长 ≈ 债券收益率",
    "Equities Favored — Growth Exceeds Bond Yield": "股票占优 — 增长超越债券收益",
    "Equities DOMINATE — Strong Growth, Cheap Money": "股票为王 — 强劲增长，廉价资金",

    // ── Indicator 3: Sahm Rule ──
    "Sahm Rule / GDP Recession Signal": "萨姆法则 / GDP衰退信号",
    "No GDP Data": "无GDP数据",
    "Open Market → Economic Data report to populate GDP rate.": "打开 市场 → 经济数据 报告以获取GDP增长率。",
    "DEEP RECESSION — GDP Collapsing": "深度衰退 — GDP崩溃",
    "Mild Recession — Fed Pivot Imminent": "轻度衰退 — 央行转向在即",
    "Stalling Growth — Watch Closely": "增长停滞 — 密切关注",
    "Slow Growth — Steady State": "缓慢增长 — 稳态",
    "Strong Growth — Expansion": "强劲增长 — 扩张",

    // ── Indicator 4: Credit Stress ──
    "Credit Stress": "信贷压力",
    "Credit Stress (Prime − Risk-Free Spread)": "信贷压力 (基准利率 − 无风险利率差)",
    "No Prime Rate Data": "无基准利率数据",
    "CREDIT STRESS — Liquidity Crisis Risk": "信贷紧张 — 流动性危机风险",
    "Tightening Credit — Caution": "信贷收紧 — 谨慎",
    "Normal Credit Conditions": "正常信贷环境",
    "Loose Credit — Easy Money Era": "宽松信贷 — 廉价资金时代",

    // ── Carry Trade (NEW) ──
    "Strong Positive Carry — Profitable Arbitrage": "强正利差 — 套利有利可图",
    "Positive Carry — Thin but Works": "正利差 — 微薄但可行",
    "Neutral Carry — No Advantage": "中性利差 — 无套利优势",
    "NEGATIVE Carry — UNWIND Positions": "负利差 — 清仓套息头寸！",
    "Insufficient Data": "数据不足",

    // ── Curve Direction (NEW) ──
    "Curve Direction": "曲线方向",
    "STEEPENING ▲": "陡峭化 ▲",
    "FLATTENING ▼": "平坦化 ▼",
    "Stable ◆": "稳定 ◆",
    "Advance 2+ quarters for trend data.": "推进2个以上季度以获取趋势数据。",

    // ── Re-Steepening Velocity (NEW) ──
    "Re-Steepening Velocity": "再陡峭化速度",
    "RAPID steepening — policy easing in effect": "快速陡峭化 — 政策宽松生效中",
    "Gradual steepening": "渐进陡峭化",
    "Stable": "稳定",
    "Gradual flattening": "渐进平坦化",
    "RAPID flattening — tightening accelerating": "快速平坦化 — 紧缩加速",
    "4+ quarters needed for annualized velocity.": "需要4个以上季度数据计算年化速度。",
    "Need 4+ quarters": "需要4个以上季度",
    "Need 2+ quarters": "需要2个以上季度",

    // ── Inversion Metrics (NEW) ──
    "Inversion Depth & Duration": "倒挂深度与持续时间",
    "CURVE INVERTED": "曲线倒挂",
    "No Inversion": "无倒挂",
    "Yield curve is normal (10Y > 2Y). No recession signal from curve shape.": "收益率曲线正常 (10Y > 2Y)。曲线形态无衰退信号。",

    // ── Cycle Phase Detector (NEW) ──
    "Insufficient History": "历史数据不足",
    "EASING": "宽松期",
    "RECOVERY": "复苏期",
    "TIGHTENING": "紧缩期",
    "PRE-RECESSION": "衰退前期",
    "INVERSION — CAUTION": "倒挂 — 警戒",
    "TRANSITION": "过渡期",

    // ── Composite Recommendations (ENHANCED) ──
    "AGGRESSIVE — FULL RISK-ON (Easing Cycle)": "激进 — 全力做多 (宽松周期)",
    "DEFENSIVE — PREPARE FOR OPPORTUNITY (Pre-Recession)": "防御 — 准备机会 (衰退前期)",
    "DEFENSIVE — MAXIMUM CAUTION": "防御 — 最高警戒",
    "Bearish Tilt — Reduce Risk": "偏空 — 降低风险",
    "Bullish Tilt — Risk-On": "偏多 — 风险偏好",
    "Transition Zone — Stay Nimble": "过渡区间 — 保持灵活",
    "Mixed Signals — Wait for Clarity": "信号混杂 — 等待明朗",

    // ── Data gaps ──
    "⚠ Missing data:": "⚠ 缺失数据：",
    " — Open Market → Economic Data or Interest Rates reports to populate these values. You can also add rates to Streaming Quotes for live updates.": " — 打开 市场 → 经济数据 或 利率报告 来加载这些数据。也可将利率加入实时行情以获取实时更新。",

    // ── Methodology ──
    "Methodology:": "方法论：",

    // ── Generic ──
    "N/A": "无数据",
    "records": "条记录",
    "quarterly snapshots": "个季度快照",
    "Qtr": "季度",
    "Spread": "利差",
    "Prime": "基准",
    "Carry": "套息",

    // ── Section toggle hints ──
    "(based on historical trends)": "(基于历史趋势)",
    "Current Phase: ": "当前阶段：",
    "◀ CURRENT": "◀ 当前",
    "◀ 当前": "◀ 当前",

    // ── Asset Class Signals ──
    "Asset Class Signals": "资产类别信号",
    "Stock Index": "股指",
    "Gold": "黄金",
    "Silver": "白银",
    "Oil": "原油",
    "Corn": "玉米",
    "Wheat": "小麦",
    "Bitcoin": "比特币",
    "Ethereum": "以太坊",

    // ── Asset action labels ──
    "OVERWEIGHT": "超配",
    "BUY": "买入",
    "HOLD": "持有",
    "REDUCE": "减仓",
    "AVOID": "回避",
    "CAUTIOUS": "谨慎",
    "ACCUMULATE": "逐步建仓",
    "UNDERWEIGHT": "低配",

    // ── Top picks section ──
    "🔺 OVERWEIGHT": "🔺 超配推荐",
    "🔻 AVOID / REDUCE": "🔻 回避/减仓",

    // ── Tax & Real Rates ──
    "Tax & Real Rates": "税务与实际利率",
    "Corporate Tax": "企业所得税",
    "Individual Tax": "个人所得税",
    "Cap Gains Tax": "资本利得税",
    "10Y Nominal": "10Y 名义收益率",
    "10Y After-Tax": "10Y 税后收益率",
    "Real 10Y Rate": "实际 10Y 利率",
    "Real Rates (Inflation-Adjusted)": "实际利率 (扣除通胀)",
    "Real 10Y": "实际 10Y",
    "Real GDP": "实际 GDP",
    "Inflation": "通胀率",
    "After-Tax Carry": "税后套息",
    "After-tax: ": "税后：",
    "net": "税后实得",
    "⚠ Wealth Tax Alert": "⚠ 财富税警告",
    "⚠ Corp Shares Tax": "⚠ 公司股票税",

    // ── Tax tags ──
    "Cap Gains": "资本利得税",
    "Ordinary Income": "普通所得税",
    "preferential": "优惠税率",
    "fully taxed": "全额征税",

    // ── Data gaps for tax ──
    "Tax data not available": "税务数据不可用",
};

// Translation helper — returns true when the game's locale is Chinese.
export function isZhCN(localeManager) {
    try { return localeManager.getCurrentLocale() === 'zh-CN'; } catch (e) { return false; }
}

// Direct lookup translator.
export function t(localeManager, english) {
    if (!isZhCN(localeManager)) return english;
    const direct = macroIndicatorsZH[english];
    if (direct !== undefined) return direct;
    return english;
}
