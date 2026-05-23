import { html, useState, useEffect, useRef, useMemo } from '../lib/preact.standalone.module.js';
import '../lib/tailwind.module.js';
import * as api from '../api.js';
import Modal from './Modal.js';
import Button from './Button.js';
import localeManager from '../locale/localeManager.js';
import { macroIndicatorsZH } from '../locale/macroIndicators-zh.js';

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 0: Utilities — translation, formatting, data access
// ══════════════════════════════════════════════════════════════════════════════

const makeT = (zh) => (english) => {
    if (!zh) return english;
    const v = macroIndicatorsZH[english];
    return v !== undefined ? v : english;
};

function getRateById(allSecurities, streamingQuotesList, id) {
    if (Array.isArray(allSecurities)) {
        const sec = allSecurities.find(s => Number(s?.id) === id);
        if (sec && sec.price != null && Number.isFinite(Number(sec.price)))
            return Number(sec.price);
    }
    if (Array.isArray(streamingQuotesList)) {
        const entry = streamingQuotesList.find(q => Number(q?.id) === id);
        if (entry && entry.price != null && Number.isFinite(Number(entry.price)))
            return Number(entry.price);
    }
    return null;
}

function fmtPct(v) {
    if (v == null || !Number.isFinite(v)) return 'N/A';
    return (v >= 0 ? '+' : '') + v.toFixed(2) + '%';
}
function fmtPctAbs(v) {
    if (v == null || !Number.isFinite(v)) return 'N/A';
    return v.toFixed(2) + '%';
}
// Small delta arrow for Key Rates dashboard tiles.
// Returns { arrow, color } or null — consumers render it as a <span>.
function deltaArrow(cur, old) {
    if (cur == null || old == null || !Number.isFinite(cur) || !Number.isFinite(old) || old === 0) return null;
    const d = cur - old;
    if (d > 0.01) return { arrow: '▲', color: '#4ade80' };
    if (d < -0.01) return { arrow: '▼', color: '#f87171' };
    return null;
}

// ── Parse central bank monetary policy from advisory summary text ──
function parseMonetaryPolicy(text, zh) {
    if (!text || typeof text !== 'string') return null;
    // Always try both English and Chinese headers — the engine's text may not
    // match the current locale setting (it may store English text natively).
    let idx = text.search(/MONETARY POLICY[：:]/);
    if (idx === -1) idx = text.search(/货币政策[：:]/);
    if (idx === -1) return null;
    const snippet = text.substring(idx, idx + 500);
    const lower = snippet.toLowerCase();

    // Aggressive easing (QE)
    if (/quantitative easing|aggressive.*easing|大幅.*宽松|qe/.test(lower))
        return { stance: 'AGGRESSIVE EASING', signal: 'bullish',
            desc: zh ? '量化宽松中。流动性最大化。风险资产最佳环境。' : 'QE active. Maximum liquidity. Best environment for risk assets.' };
    // Easing / stimulative
    if (/easy money|easing\b|stimulative|宽松|刺激|lower.*rates|降息|ends tight|结束.*紧缩/.test(lower))
        return { stance: 'EASING', signal: 'bullish',
            desc: zh ? '宽松政策。利好股票和债券。融资成本下降。' : 'Accommodative policy. Favorable for equities and bonds. Funding costs falling.' };
    // Tightening / restrictive
    if (/tight.*money|tightening|restrictive|紧缩|收紧|raises rates|加息|restrictive|ends easy|结束.*宽松/.test(lower))
        return { stance: 'TIGHTENING', signal: 'bearish',
            desc: zh ? '紧缩政策。风险资产承压。融资成本上升。' : 'Restrictive policy. Headwind for risk assets. Funding costs rising.' };
    // Neutral / steady
    if (/\bneutral\b|steady|stable policy|中性|稳定|不变/.test(lower))
        return { stance: 'NEUTRAL', signal: 'neutral',
            desc: zh ? '政策中性。等待方向选择。关注政策转向信号。' : 'Policy on hold. Watch for directional change signals.' };

    return { stance: 'UNKNOWN', signal: 'neutral',
        desc: zh ? '无法从摘要文本中分类政策立场。' : 'Could not classify policy stance from advisory text.' };
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 1: Sub-components — SignalBadge, RecommendationBox, PhaseBar
// ══════════════════════════════════════════════════════════════════════════════

const SignalBadge = ({ signal, label, detail, size }) => {
    const colors = {
        bullish:   { bg: 'rgba(34,197,94,0.18)',  border: '#22c55e', text: '#4ade80', icon: '▲' },
        bearish:   { bg: 'rgba(239,68,68,0.18)',  border: '#ef4444', text: '#f87171', icon: '▼' },
        neutral:   { bg: 'rgba(234,179,8,0.18)',  border: '#eab308', text: '#facc15', icon: '◆' },
        warning:   { bg: 'rgba(249,115,22,0.18)', border: '#f97316', text: '#fb923c', icon: '⚠' },
    };
    const c = colors[signal] || colors.neutral;
    const compact = size === 'compact';
    return html`
        <div style="background:${c.bg}; border:1px solid ${c.border}; border-radius:6px; padding:${compact ? '5px 8px' : '8px 10px'}; display:flex; align-items:center; gap:${compact ? '6px' : '8px'};">
            <span style="color:${c.text}; font-size:${compact ? '13px' : '16px'};">${c.icon}</span>
            <div style="flex:1; min-width:0;">
                <div style="color:${c.text}; font-weight:600; font-size:${compact ? '11px' : '13px'};">${label}</div>
                ${detail ? html`<div style="color:#9ca3af; font-size:${compact ? '10px' : '11px'}; margin-top:1px;">${detail}</div>` : ''}
            </div>
        </div>
    `;
};

const RecommendationBox = ({ title, children, type }) => {
    const styles = {
        buy:    { border: '#22c55e', bg: 'rgba(34,197,94,0.08)',  icon: '\u{1F4C8}' },
        sell:   { border: '#ef4444', bg: 'rgba(239,68,68,0.08)',  icon: '\u{1F4C9}' },
        hold:   { border: '#eab308', bg: 'rgba(234,179,8,0.08)',  icon: '\u{1F4CA}' },
        info:   { border: '#3b82f6', bg: 'rgba(59,130,246,0.08)',  icon: 'ℹ️' },
    };
    const s = styles[type] || styles.info;
    return html`
        <div style="border:1px solid ${s.border}; background:${s.bg}; border-radius:8px; padding:12px 14px;">
            <div style="font-weight:700; font-size:13px; color:${s.border}; margin-bottom:6px;">${s.icon} ${title}</div>
            <div style="font-size:12px; color:#d1d5db; line-height:1.5;">${children}</div>
        </div>
    `;
};

const PhaseBar = ({ phase, zh }) => {
    const stages = zh
        ? ['宽松期', '复苏期', '紧缩期', '衰退前期']
        : ['Easing', 'Recovery', 'Tightening', 'Pre-Recession'];
    const colors = ['#4ade80', '#60a5fa', '#f97316', '#ef4444'];
    const idx = Math.max(0, Math.min(3, phase - 1)); // phase 0 → no highlight
    const active = phase >= 1 && phase <= 4;
    return html`
        <div style="display:flex; align-items:center; gap:4px; margin-top:6px;">
            ${stages.map((s, i) => html`
                <div style="flex:1; text-align:center;">
                    <div style="height:6px; border-radius:3px; background:${active && i === idx ? colors[i] : 'rgba(255,255,255,0.1)'}; margin-bottom:3px; transition:background 0.3s;"></div>
                    <div style="font-size:9px; color:${active && i === idx ? colors[i] : '#6b7280'}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                        ${active && i === idx ? '● ' : ''}${s}
                    </div>
                </div>
            `)}
            ${active ? '' : html`<div style="font-size:9px; color:#6b7280; white-space:nowrap;">${zh ? '（数据不足）' : '(insufficient data)'}</div>`}
        </div>
    `;
};

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 2: History & snapshot helpers
// ══════════════════════════════════════════════════════════════════════════════

function buildSnapshot(y, q, lb, sb, pr, gdp) {
    return {
        y, q,
        lb: lb != null && Number.isFinite(lb) ? lb : null,
        sb: sb != null && Number.isFinite(sb) ? sb : null,
        pr: pr != null && Number.isFinite(pr) ? pr : null,
        gdp: gdp != null && Number.isFinite(gdp) ? gdp : null,
        spread: (lb != null && sb != null && Number.isFinite(lb) && Number.isFinite(sb)) ? lb - sb : null,
        carry: (lb != null && pr != null && Number.isFinite(lb) && Number.isFinite(pr)) ? lb - pr : null,
        credit: (pr != null && sb != null && Number.isFinite(pr) && Number.isFinite(sb)) ? pr - sb : null,
    };
}

function curveDirection(history) {
    if (!history || history.length < 2) return { dir: null, delta: null, label: 'Need 2+ quarters', signal: 'neutral' };
    const a = history[history.length - 1].spread;
    const b = history[history.length - 2].spread;
    if (a == null || b == null) return { dir: null, delta: null, label: 'Insufficient data', signal: 'neutral' };
    const delta = a - b;
    if (delta > 0.10) return { dir: 'steepening', delta, label: 'STEEPENING ▲', signal: 'bullish', arrow: '▲' };
    if (delta < -0.10) return { dir: 'flattening', delta, label: 'FLATTENING ▼', signal: 'bearish', arrow: '▼' };
    return { dir: 'stable', delta, label: 'Stable ◆', signal: 'neutral', arrow: '◆' };
}

function reSteepeningVelocity(history) {
    if (!history || history.length < 5) return { vel: null, label: 'Need 4+ quarters', signal: 'neutral' };
    const a = history[history.length - 1].spread;
    const b = history[history.length - 5].spread; // 4 quarters ago = 1 year
    if (a == null || b == null) return { vel: null, label: 'Insufficient data', signal: 'neutral' };
    const vel = a - b; // 4-quarter delta
    if (vel > 1.0) return { vel, label: 'RAPID steepening — policy easing in effect', signal: 'bullish' };
    if (vel > 0.3) return { vel, label: 'Gradual steepening', signal: 'bullish' };
    if (vel > -0.3) return { vel, label: 'Stable', signal: 'neutral' };
    if (vel > -1.0) return { vel, label: 'Gradual flattening', signal: 'warning' };
    return { vel, label: 'RAPID flattening — tightening accelerating', signal: 'bearish' };
}

function inversionMetrics(spread, history) {
    const depth = spread != null && spread < 0 ? Math.abs(spread) : 0;
    let duration = 0;
    if (history && history.length > 0) {
        for (let i = history.length - 1; i >= 0; i--) {
            if (history[i].spread != null && history[i].spread < 0) duration++;
            else break;
        }
    }
    return { depth, duration, isInverted: spread != null && spread < 0 };
}

function detectCyclePhase(primeRate, gdp, spread, history) {
    if (!history || history.length < 2) return { phase: 0, label: 'Insufficient History', color: 'neutral', detail: 'Advance 2+ quarters for cycle detection.' };

    const prev = history[history.length - 2];
    const rateRef = history.length >= 5 ? history[history.length - 5].pr : prev.pr;
    const gdpRef = history.length >= 5 ? history[history.length - 5].gdp : prev.gdp;

    const rateMoving = (primeRate != null && rateRef != null) ? primeRate - rateRef : 0;
    const curveMoving = (spread != null && prev.spread != null) ? spread - prev.spread : 0;
    const gdpMoving = (gdp != null && gdpRef != null) ? gdp - gdpRef : 0;

    const ratesFalling = rateMoving < -0.25;
    const ratesRising = rateMoving > 0.25;
    const curveSteepening = curveMoving > 0.10;
    const curveFlattening = curveMoving < -0.10;
    const gdpRising = gdpMoving > 0.25;
    const gdpFalling = gdpMoving < -0.5;
    const curveInverted = spread != null && spread < 0;

    if (ratesFalling && curveSteepening)
        return { phase: 1, label: 'EASING', color: 'bullish', detail: 'Rates falling, curve steepening. BEST for arbitrage. Borrow short, buy long-duration assets.' };
    if (gdpRising && !curveInverted && !ratesRising)
        return { phase: 2, label: 'RECOVERY', color: 'bullish', detail: 'GDP rising, credit expanding. Risk-on environment. Favor equities over bonds.' };
    if (ratesRising && (curveFlattening || curveInverted))
        return { phase: 3, label: 'TIGHTENING', color: 'warning', detail: 'Rates rising, curve flattening. Reduce duration exposure. Build cash reserves.' };
    if (curveInverted && gdpFalling)
        return { phase: 4, label: 'PRE-RECESSION', color: 'bearish', detail: 'Curve inverted, GDP slowing. The big opportunity is approaching. Buy long bonds, screen for distressed assets.' };
    if (curveInverted)
        return { phase: 4, label: 'INVERSION — CAUTION', color: 'bearish', detail: 'Yield curve is inverted. Recession risk is elevated. Position for eventual rate cuts.' };
    return { phase: 0, label: 'TRANSITION', color: 'neutral', detail: 'Mixed macroeconomic signals. No clear cycle phase dominant.' };
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 3: Main component
// ══════════════════════════════════════════════════════════════════════════════

const MacroIndicatorPanel = ({ show, onClose }) => {
    // ── Game state subscriptions ──
    const gameLoaded = api.useGameStore(s => s.gameState.gameLoaded);
    const primeRate = api.useGameStore(s => s.gameState.primeRate);
    const gnpRate = api.useGameStore(s => s.gameState.gnpRate ?? s.gameState.gdpRate ?? s.gameState.gdp);
    const allSecurities = api.useGameStore(s => s.gameState.allSecurities) || [];
    const streamingQuotesList = api.useGameStore(s => s.gameState.streamingQuotesList) || [];
    const currentYear = api.useGameStore(s => s.gameState.currentYear);
    const currentQuarter = api.useGameStore(s => s.gameState.currentQuarter);
    const locale = api.useGameStore(s => s.gameState.locale);
    const customData = api.useGameStore(s => s.gameState?.customData);

    // ── Locale sync ──
    useEffect(() => { if (locale) localeManager.syncFromGameState(locale); }, [locale]);
    const zh = locale === 'zh-CN';
    const t = makeT(zh);

    // ── Rate extraction ──
    const longBondRate = getRateById(allSecurities, streamingQuotesList, api.TBOND_RATE_ID);
    const shortBondRate = getRateById(allSecurities, streamingQuotesList, api.SBOND_RATE_ID);
    const primeFromSecurities = getRateById(allSecurities, streamingQuotesList, api.PRIME_RATE_ID);
    const gnpFromSecurities = getRateById(allSecurities, streamingQuotesList, api.GNP_RATE_ID);
    const effectivePrime = primeFromSecurities ?? primeRate;
    const effectiveGNP = gnpFromSecurities ?? gnpRate;

    // Get oldPrice for delta display in dashboard
    const lbOld = allSecurities.find(s => Number(s?.id) === api.TBOND_RATE_ID)?.oldPrice ?? null;
    const sbOld = allSecurities.find(s => Number(s?.id) === api.SBOND_RATE_ID)?.oldPrice ?? null;
    const prOld = allSecurities.find(s => Number(s?.id) === api.PRIME_RATE_ID)?.oldPrice ?? null;

    // ── Asset prices & trends (for per-asset-class signals) ──
    const getAsset = (id) => allSecurities.find(s => Number(s?.id) === id);
    const assetPrice = (id) => { const s = getAsset(id); return s?.price ?? null; };
    const assetOldPrice = (id) => { const s = getAsset(id); return s?.oldPrice ?? null; };
    const assetPctChange = (id) => {
        const cur = assetPrice(id), old = assetOldPrice(id);
        if (cur == null || old == null || !Number.isFinite(old) || old === 0) return null;
        return ((cur - old) / Math.abs(old)) * 100;
    };
    const assetUp = (id) => { const ch = assetPctChange(id); return ch !== null && ch > 0; };
    const assetDown = (id) => { const ch = assetPctChange(id); return ch !== null && ch < 0; };

    // ── Tax rates & econ data (regex-parsed from economicDataReport TEXT ARRAY) ──
    // The report is a string[], NOT a structured object. The engine only populates
    // it when the player views the "Economic Statistics and Data" report.
    // We proactively trigger it when the panel opens and data is missing.
    const econReportLines = api.useGameStore(s => s.gameState.economicDataReport) || [];
    const playerFin = api.useGameStore(s => s.gameState.activeEntityPlayerFinancials) || {};

    const parsedEcon = useMemo(() => {
        // Handle both array and string forms of the report
        let lines = [];
        if (Array.isArray(econReportLines)) lines = econReportLines;
        else if (typeof econReportLines === 'string' && econReportLines.length > 0) lines = econReportLines.split(/\r?\n/);
        else return {};
        const r = {};
        for (const line of lines) {
            if (typeof line !== 'string') continue;
            let m;
            // Try English patterns first, then Chinese (the game translates report text)
            m = line.match(/Corporate Income Tax Rate:\s+(\d+(?:\.\d+)?)\s*%/) || line.match(/企业所得税率：\s+(\d+(?:\.\d+)?)\s*%/);
            if (m) r.corpTaxRate = parseFloat(m[1]);
            m = line.match(/Indiv\. Rate on Ordinary Income:\s+(\d+(?:\.\d+)?)\s*%/) || line.match(/个人普通收入税率：\s+(\d+(?:\.\d+)?)\s*%/);
            if (m) r.indivTaxRate = parseFloat(m[1]);
            m = line.match(/Indiv\. Rate on Capital Gains:\s+(\d+(?:\.\d+)?)\s*%/) || line.match(/个人资本利得税率：\s+(\d+(?:\.\d+)?)\s*%/);
            if (m) r.capGainsTaxRate = parseFloat(m[1]);
            // Wealth Tax: check for (NONE) or Chinese （无）first, then percentage
            if (/Wealth Tax on Billionaires:\s*\(NONE\)/.test(line) || /亿万富翁财富税：\s*（无）/.test(line)) r.wealthTaxNone = true;
            m = line.match(/Wealth Tax on Billionaires:\s+(\d+(?:\.\d+)?)\s*%/) || line.match(/亿万富翁财富税：\s+(\d+(?:\.\d+)?)\s*%/);
            if (m) r.wealthTaxRate = parseFloat(m[1]);
            // Corporate Shares Tax
            if (/Corporate Shares Tax:\s*\(NONE\)/.test(line) || /企业股份税：\s*（无）/.test(line)) r.corpSharesNone = true;
            m = line.match(/Corporate Shares Tax:\s+(\d+(?:\.\d+)?)\s*%/) || line.match(/企业股份税：\s+(\d+(?:\.\d+)?)\s*%/);
            if (m) r.corpSharesTaxRate = parseFloat(m[1]);
            // GDP growth rate from report
            m = line.match(/CURRENT GROWTH RATE.*GDP:\s+(\d+(?:\.\d+)?)\s*%/) || line.match(/美国GDP当前增长率：\s+(\d+(?:\.\d+)?)\s*%/);
            if (m) r.reportedGDP = parseFloat(m[1]);
            // Prime rate from report
            m = line.match(/PRIME INTEREST RATE ON LOANS:\s+(\d+(?:\.\d+)?)\s*%/) || line.match(/贷款优惠利率：\s+(\d+(?:\.\d+)?)\s*%/);
            if (m) r.reportedPrime = parseFloat(m[1]);
        }
        return r;
    }, [econReportLines]);

    const corpTaxRate = parsedEcon.corpTaxRate ?? null;
    const indivTaxRate = parsedEcon.indivTaxRate ?? null;
    const capGainsTaxRate = parsedEcon.capGainsTaxRate ?? null;
    const effectiveCapGainsRate = capGainsTaxRate ?? (indivTaxRate != null ? indivTaxRate * 0.5 : null);
    const reportedGDP = parsedEcon.reportedGDP ?? null;
    const reportedPrime = parsedEcon.reportedPrime ?? null;

    // Player tax position
    const wealthTaxProjected = playerFin.wealthTaxProjected ?? null;
    const corpSharesTax = playerFin.corpSharesTax ?? null;
    const wealthTaxNone = parsedEcon.wealthTaxNone === true;

    // ── Derivatives positions (parsed from text report arrays) ──
    const optionsList = api.useGameStore(s => s.gameState.optionsList) || [];
    const commodityList = api.useGameStore(s => s.gameState.commodityList) || [];
    const swapsPortfolio = api.useGameStore(s => s.gameState.swapsPortfolio) || [];

    // ── Central bank monetary policy (from advisory summary text) ──
    const advisorySummary = api.useGameStore(s => s.gameState.advisorySummary) || '';

    const policyData = useMemo(() => {
        return parseMonetaryPolicy(advisorySummary, zh);
    }, [advisorySummary, zh]);

    // Parse market value from option text line (byte 72+ after stripping hyperlink)
    function parseOptionValue(line) {
        if (typeof line !== 'string') return null;
        // Strip the @TYPE hyperlink suffix first (renderLines does this for display)
        const atIdx = line.lastIndexOf('@');
        const clean = atIdx !== -1 ? line.substring(0, atIdx).trimEnd() : line;
        if (clean.length < 73) return null;
        const tail = clean.substring(72);
        const v = parseFloat(tail.trim());
        return Number.isFinite(v) ? v : null;
    }

    // Extract type from hyperlink marker at end of line: @TYPE|ID or @TYPEID
    function parseLinkType(line) {
        if (typeof line !== 'string') return null;
        const m = line.match(/@([A-Z]+)\d/);
        return m ? m[1] : null;
    }

    const derivativesSummary = useMemo(() => {
        const opts = { longCall: 0, longPut: 0, shortCall: 0, shortPut: 0 };
        const optsVal = { longCall: 0, longPut: 0, shortCall: 0, shortPut: 0 };
        if (Array.isArray(optionsList)) {
            for (const line of optionsList) {
                if (typeof line !== 'string') continue;
                const type = parseLinkType(line);
                const val = parseOptionValue(line) || 0;
                if (type === 'LONGCALL') { opts.longCall++; optsVal.longCall += val; }
                else if (type === 'LONGPUT') { opts.longPut++; optsVal.longPut += val; }
                else if (type === 'SHORTCALL') { opts.shortCall++; optsVal.shortCall += val; }
                else if (type === 'SHORTPUT') { opts.shortPut++; optsVal.shortPut += val; }
            }
        }
        const totalOptVal = optsVal.longCall + optsVal.longPut + optsVal.shortCall + optsVal.shortPut;
        const hasOptVal = totalOptVal > 0;

        const fut = { longFutures: 0, shortFutures: 0, physicalLong: 0, cryptoLong: 0 };
        if (Array.isArray(commodityList)) {
            for (const line of commodityList) {
                if (typeof line !== 'string') continue;
                const type = parseLinkType(line);
                if (type === 'P') fut.physicalLong++;
                else if (type === 'PC') fut.cryptoLong++;
                else if (type === 'F' || type === 'CF') {
                    const hasNeg = /-\d/.test(line.substring(2));
                    if (hasNeg) fut.shortFutures++; else fut.longFutures++;
                }
            }
        }

        const swaps = Array.isArray(swapsPortfolio) ? swapsPortfolio.length : 0;

        const totalOptions = opts.longCall + opts.longPut + opts.shortCall + opts.shortPut;
        const totalFutures = fut.longFutures + fut.shortFutures;
        const hasDerivatives = totalOptions > 0 || totalFutures > 0 || swaps > 0;

        // Net directional bias (simplified)
        const optBias = (opts.longCall + opts.longPut) - (opts.shortCall + opts.shortPut);
        const futBias = fut.longFutures - fut.shortFutures;

        return { opts, optsVal, hasOptVal, fut, swaps, totalOptions, totalFutures, hasDerivatives, optBias, futBias };
    }, [optionsList, commodityList, swapsPortfolio]);

    // ── Historical tracking ──
    const restoredRef = useRef(false);
    const backfillDoneRef = useRef(false);
    const history = Array.isArray(customData?.macroHistory) ? customData.macroHistory : [];

    // Restore gate: prevent overwriting saved history with empty array on first render
    useEffect(() => {
        if (restoredRef.current || !gameLoaded) return;
        restoredRef.current = true;
    }, [customData, gameLoaded]);

    // Backfill: on first load with empty history, pull past data from /asset_chart
    // so the user doesn't start from zero. The game engine stores 60 months of
    // price history per asset; we group by quarter and build snapshot entries.
    useEffect(() => {
        if (!restoredRef.current || !gameLoaded) return;
        if (backfillDoneRef.current) return;
        if (history.length > 0) { backfillDoneRef.current = true; return; }
        backfillDoneRef.current = true;

        (async () => {
            try {
                const ids = [api.TBOND_RATE_ID, api.SBOND_RATE_ID, api.PRIME_RATE_ID, api.GNP_RATE_ID];
                const charts = await Promise.all(ids.map(id => api.getAssetChart(id).catch(() => null)));

                // All four series share the same base month/year and length.
                const ref = charts.find(c => c && Array.isArray(c.prices) && c.prices.length >= 2);
                if (!ref) return;

                const len = ref.prices.length;
                const baseMonth = typeof ref.baseMonth === 'number' ? ref.baseMonth : 0;
                const baseYear = typeof ref.baseYear === 'number' ? ref.baseYear : currentYear;

                // Group monthly data into quarterly buckets.
                // Key = "YEAR-Q", value = { months: [0,1,2], lbVals: [], sbVals: [], prVals: [], gdpVals: [] }
                const quarters = {};
                for (let i = 0; i < len; i++) {
                    const absMonth = baseMonth + i;
                    const y = baseYear + Math.floor(absMonth / 12);
                    const q = Math.floor((absMonth % 12) / 3) + 1; // 1-4
                    const key = `${y}-${q}`;
                    if (!quarters[key]) quarters[key] = { y, q, lb: [], sb: [], pr: [], gdp: [] };
                    // chart index: 0=TBOND, 1=SBOND, 2=PRIME, 3=GNP
                    const pushVal = (arr, ci) => {
                        const v = charts[ci]?.prices?.[i];
                        if (v != null && Number.isFinite(v) && v !== 0) arr.push(v);
                    };
                    pushVal(quarters[key].lb, 0);
                    pushVal(quarters[key].sb, 1);
                    pushVal(quarters[key].pr, 2);
                    pushVal(quarters[key].gdp, 3);
                }

                // Build snapshots: take the LAST valid value in each quarter.
                const backfilled = [];
                const sortedKeys = Object.keys(quarters).sort();
                for (const key of sortedKeys) {
                    const q = quarters[key];
                    const last = (arr) => arr.length > 0 ? arr[arr.length - 1] : null;
                    const snap = buildSnapshot(q.y, q.q, last(q.lb), last(q.sb), last(q.pr), last(q.gdp));
                    if (snap.lb != null || snap.sb != null) backfilled.push(snap);
                }

                // Don't include the current quarter (snapshot effect handles it live).
                const curKey = `${currentYear}-${currentQuarter}`;
                const filtered = backfilled.filter(s => `${s.y}-${s.q}` !== curKey).slice(-40);

                if (filtered.length > 0) {
                    debouncedSaveHistory(filtered);
                }
            } catch (e) {
                console.warn('[MacroIndicators] Backfill failed:', e);
            }
        })();
    }, [restoredRef, gameLoaded, history.length, currentYear, currentQuarter]);

    // Debounced save
    const debouncedSaveHistory = useMemo(
        () => {
            let timer = null;
            return (h) => {
                if (timer) clearTimeout(timer);
                timer = setTimeout(() => {
                    api.setCustomData({ macroHistory: h }).catch(() => {});
                }, 500);
            };
        },
        []
    );

    // Snapshot on quarter change
    useEffect(() => {
        if (!restoredRef.current || !gameLoaded) return;
        if (longBondRate == null && shortBondRate == null) return;
        const last = history[history.length - 1];
        if (last && last.y === currentYear && last.q === currentQuarter) return;
        const entry = buildSnapshot(currentYear, currentQuarter, longBondRate, shortBondRate, effectivePrime, effectiveGNP);
        const updated = [...history, entry].slice(-40);
        debouncedSaveHistory(updated);
    }, [currentYear, currentQuarter, gameLoaded, longBondRate, shortBondRate, effectivePrime, effectiveGNP]);

    // ── Cached values (survive view switches when engine clears report fields) ──
    const [cachedTax, setCachedTax] = useState(null);
    const [cachedPolicy, setCachedPolicy] = useState(null);

    // ── Collapsible section state ──
    const [sections, setSections] = useState({
        rates: true, curve: true, growth: true, cycle: true, tax: true, assets: true,
        recommendation: true, playbook: true, history: false,
    });
    const toggle = (key) => setSections(prev => ({ ...prev, [key]: !prev[key] }));

    // ═══════════════════════════════════════════════════════════════════
    // Computed indicators (useMemo blocks)
    // ═══════════════════════════════════════════════════════════════════

    // ── Yield Curve Spread ──
    const yieldSpread = useMemo(() => {
        if (longBondRate == null || shortBondRate == null) return null;
        return longBondRate - shortBondRate;
    }, [longBondRate, shortBondRate]);

    const yieldCurveSignal = useMemo(() => {
        if (yieldSpread == null) return {
            signal: 'neutral',
            label: t('Data Insufficient'),
            detail: t('Open Market → Interest Rates report to populate bond yields.'),
        };
        if (yieldSpread < -0.5) return {
            signal: 'bearish',
            label: t('DEEPLY INVERTED — Recession Signal'),
            detail: zh ? `利差：${fmtPct(yieldSpread)}。市场定价激进降息。立即锁定长期债券。`
                     : `Spread: ${fmtPct(yieldSpread)}. Market pricing in aggressive rate cuts. Lock in long bonds NOW.`,
        };
        if (yieldSpread < 0) return {
            signal: 'warning',
            label: t('Mildly Inverted — Caution'),
            detail: zh ? `利差：${fmtPct(yieldSpread)}。准备切换。债券优于股票。`
                     : `Spread: ${fmtPct(yieldSpread)}. Prepare for transition. Favor bonds over stocks.`,
        };
        if (yieldSpread < 0.5) return {
            signal: 'neutral',
            label: t('Flat Curve — Transition Zone'),
            detail: zh ? `利差：${fmtPct(yieldSpread)}。密切关注。拐点临近。`
                     : `Spread: ${fmtPct(yieldSpread)}. Watch closely. Switch point approaching.`,
        };
        return {
            signal: 'bullish',
            label: t('Normal / Steep — Expansion'),
            detail: zh ? `利差：${fmtPct(yieldSpread)}。低利率窗口开启。发行长期债务，购买资产。`
                     : `Spread: ${fmtPct(yieldSpread)}. Low-rate window open. Issue long debt, buy assets.`,
        };
    }, [yieldSpread, zh, t]);

    // ── Growth-Yield Differential ──
    const growthYieldData = useMemo(() => {
        if (effectiveGNP == null) return {
            signal: 'neutral',
            label: t('No GDP Growth Data'),
            detail: t('View Economic Data report to populate GDP rate.'),
        };
        const bondYield = longBondRate ?? effectivePrime;
        if (bondYield == null) return {
            signal: 'neutral',
            label: t('No Bond Yield Data'),
            detail: t('Need Long Bond Rate or Prime Rate for the yield comparison.'),
        };
        const diff = effectiveGNP - bondYield;
        let signal, label, detail;
        if (diff < -3) {
            signal = 'bearish';
            label = t('Bonds DOMINATE — Risk-Free Yield Far Exceeds Growth');
            detail = zh ? `增长率：${fmtPct(effectiveGNP)} | 债券收益率：${fmtPctAbs(bondYield)} | 差额：${fmtPct(diff)}。卖出股票，买入债券。`
                     : `Growth: ${fmtPct(effectiveGNP)} | Bond Yield: ${fmtPctAbs(bondYield)} | Diff: ${fmtPct(diff)}. SELL equities, BUY bonds.`;
        } else if (diff < -1) {
            signal = 'warning';
            label = t('Bonds Favored — Yield Premium Over Growth');
            detail = zh ? `增长率：${fmtPct(effectiveGNP)} | 债券收益率：${fmtPctAbs(bondYield)} | 差额：${fmtPct(diff)}。转向债券配置。`
                     : `Growth: ${fmtPct(effectiveGNP)} | Bond Yield: ${fmtPctAbs(bondYield)} | Diff: ${fmtPct(diff)}. Rotate toward bonds.`;
        } else if (diff < 1) {
            signal = 'neutral';
            label = t('Balanced — Growth ≈ Bond Yield');
            detail = zh ? `增长率：${fmtPct(effectiveGNP)} | 债券收益率：${fmtPctAbs(bondYield)} | 差额：${fmtPct(diff)}。公允价值区间。关注分化信号。`
                     : `Growth: ${fmtPct(effectiveGNP)} | Bond Yield: ${fmtPctAbs(bondYield)} | Diff: ${fmtPct(diff)}. Fair value zone. Watch for divergence.`;
        } else if (diff < 3) {
            signal = 'bullish';
            label = t('Equities Favored — Growth Exceeds Bond Yield');
            detail = zh ? `增长率：${fmtPct(effectiveGNP)} | 债券收益率：${fmtPctAbs(bondYield)} | 差额：${fmtPct(diff)}。偏好股票。发债购买资产。`
                     : `Growth: ${fmtPct(effectiveGNP)} | Bond Yield: ${fmtPctAbs(bondYield)} | Diff: ${fmtPct(diff)}. Favor stocks. Issue debt to buy assets.`;
        } else {
            signal = 'bullish';
            label = t('Equities DOMINATE — Strong Growth, Cheap Money');
            detail = zh ? `增长率：${fmtPct(effectiveGNP)} | 债券收益率：${fmtPctAbs(bondYield)} | 差额：${fmtPct(diff)}。激进做多。加杠杆。`
                     : `Growth: ${fmtPct(effectiveGNP)} | Bond Yield: ${fmtPctAbs(bondYield)} | Diff: ${fmtPct(diff)}. Aggressive risk-on. Leverage up.`;
        }
        return { signal, label, detail };
    }, [effectiveGNP, longBondRate, effectivePrime, zh, t]);

    // ── Sahm / Macro Health ──
    const macroData = useMemo(() => {
        if (effectiveGNP == null) return {
            signal: 'neutral',
            label: t('No GDP Data'),
            detail: t('Open Market → Economic Data report to populate GDP rate.'),
        };
        const gnp = Number(effectiveGNP);
        let signal, label, detail;
        if (gnp < -2) {
            signal = 'bearish';
            label = t('DEEP RECESSION — GDP Collapsing');
            detail = zh ? `GDP增长率：${fmtPct(gnp)}。央行将被迫激进降息。买入长期债券。`
                     : `GDP Growth: ${fmtPct(gnp)}. Central bank will be forced to cut rates aggressively. BUY long bonds.`;
        } else if (gnp < 0) {
            signal = 'bearish';
            label = t('Mild Recession — Fed Pivot Imminent');
            detail = zh ? `GDP增长率：${fmtPct(gnp)}。萨姆法则等效触发。准备迎接降息。`
                     : `GDP Growth: ${fmtPct(gnp)}. Sahm Rule equivalent triggered. Prepare for rate cuts.`;
        } else if (gnp < 1) {
            signal = 'warning';
            label = t('Stalling Growth — Watch Closely');
            detail = zh ? `GDP增长率：${fmtPct(gnp)}。若转为负值，降息将成定局。`
                     : `GDP Growth: ${fmtPct(gnp)}. If it turns negative, rate cuts become certain.`;
        } else if (gnp < 2.5) {
            signal = 'neutral';
            label = t('Slow Growth — Steady State');
            detail = zh ? `GDP增长率：${fmtPct(gnp)}。央行无紧迫压力。`
                     : `GDP Growth: ${fmtPct(gnp)}. No urgency from the central bank.`;
        } else {
            signal = 'bullish';
            label = t('Strong Growth — Expansion');
            detail = zh ? `GDP增长率：${fmtPct(gnp)}。经济过热。警惕通胀和加息风险。`
                     : `GDP Growth: ${fmtPct(gnp)}. Economy running hot. Watch for inflation / rate hikes.`;
        }
        return { signal, label, detail };
    }, [effectiveGNP, zh, t]);

    // ── Credit Spread ──
    const creditData = useMemo(() => {
        if (effectivePrime == null) return { signal: 'neutral', label: t('No Prime Rate Data'), detail: '' };
        const rfRate = shortBondRate ?? longBondRate ?? 0;
        const spread = effectivePrime - rfRate;
        let signal, label, detail;
        if (spread > 5) {
            signal = 'bearish';
            label = t('CREDIT STRESS — Liquidity Crisis Risk');
            detail = zh ? `基准-无风险利差：${fmtPct(spread)}。企业融资困难。降息即将被迫到来。准备收购困境资产。`
                     : `Prime-RiskFree Spread: ${fmtPct(spread)}. Companies struggling to borrow. Forced rate cuts ahead. Prepare to buy distressed assets.`;
        } else if (spread > 3) {
            signal = 'warning';
            label = t('Tightening Credit — Caution');
            detail = zh ? `基准-无风险利差：${fmtPct(spread)}。信贷条件恶化。降低杠杆。`
                     : `Prime-RiskFree Spread: ${fmtPct(spread)}. Credit conditions deteriorating. Reduce leverage.`;
        } else if (spread > 1.5) {
            signal = 'neutral';
            label = t('Normal Credit Conditions');
            detail = zh ? `基准-无风险利差：${fmtPct(spread)}。标准借贷环境。`
                     : `Prime-RiskFree Spread: ${fmtPct(spread)}. Standard lending environment.`;
        } else {
            signal = 'bullish';
            label = t('Loose Credit — Easy Money Era');
            detail = zh ? `基准-无风险利差：${fmtPct(spread)}。信贷自由流动。借款投资的好时机。`
                     : `Prime-RiskFree Spread: ${fmtPct(spread)}. Credit flowing freely. Good time to borrow and invest.`;
        }
        return { signal, label, detail };
    }, [effectivePrime, shortBondRate, longBondRate, zh, t]);

    // ── Carry Trade Space (NEW) ──
    const carryTradeData = useMemo(() => {
        if (longBondRate == null || effectivePrime == null) return { signal: 'neutral', label: t('Insufficient Data'), detail: '' };
        const carry = longBondRate - effectivePrime;
        let signal, label, detail;
        if (carry > 2.0) {
            signal = 'bullish';
            label = t('Strong Positive Carry — Profitable Arbitrage');
            detail = zh ? `套息空间：${fmtPct(carry)}。以基准利率借款，以10年期利率放贷。正利差。`
                     : `Carry: ${fmtPct(carry)} (10Y ${fmtPctAbs(longBondRate)} − Prime ${fmtPctAbs(effectivePrime)}). Borrow at Prime, lend at 10Y. Profitable.`;
        } else if (carry > 0.5) {
            signal = 'bullish';
            label = t('Positive Carry — Thin but Works');
            detail = zh ? `套息空间：${fmtPct(carry)}。利差微薄但为正。监控融资成本。`
                     : `Carry: ${fmtPct(carry)}. Thin but positive carry. Monitor funding costs.`;
        } else if (carry > -0.5) {
            signal = 'neutral';
            label = t('Neutral Carry — No Advantage');
            detail = zh ? `套息空间：${fmtPct(carry)}。无套利空间。等待利差扩大。`
                     : `Carry: ${fmtPct(carry)}. No carry advantage. Wait for spread to widen.`;
        } else {
            signal = 'bearish';
            label = t('NEGATIVE Carry — UNWIND Positions');
            detail = zh ? `套息空间：${fmtPct(carry)}。负利差！融资成本高于资产收益。清仓套息头寸！`
                     : `Carry: ${fmtPct(carry)}. NEGATIVE. Funding costs exceed asset yields. UNWIND carry positions.`;
        }
        return { carry, signal, label, detail };
    }, [longBondRate, effectivePrime, zh, t]);

    // ── Curve Direction (NEW — from history) ──
    const curveDirData = useMemo(() => {
        const dir = curveDirection(history);
        if (dir.dir == null) {
            const need = Math.max(0, 2 - history.length);
            return {
                signal: 'neutral',
                label: zh ? `还需 ${need} 个季度` : `Need ${need} more quarter(s)`,
                detail: zh ? `已有 ${history.length} 个季度快照，需至少 2 个季度计算曲线方向。` : `Have ${history.length} snapshot(s), need 2+ for curve direction.`,
            };
        }
        const detail = zh
            ? `曲线变动：${fmtPct(dir.delta)}/季度。${dir.label}。`
            : `Curve delta: ${fmtPct(dir.delta)}/quarter. ${dir.label}.`;
        return { signal: dir.signal, label: t(dir.label), detail };
    }, [history, zh, t]);

    // ── Re-Steepening Velocity (NEW) ──
    const velocityData = useMemo(() => {
        const v = reSteepeningVelocity(history);
        if (v.vel == null) {
            const need = Math.max(0, 5 - history.length);
            return {
                signal: 'neutral',
                label: zh ? `还需 ${need} 个季度` : `Need ${need} more quarter(s)`,
                detail: zh ? `已有 ${history.length} 个季度快照，需至少 5 个季度计算年化速度。` : `Have ${history.length} snapshot(s), need 5+ for annualized velocity.`,
            };
        }
        const detail = zh
            ? `年化速度：${fmtPct(v.vel)}/年。${v.label}。`
            : `Annualized: ${fmtPct(v.vel)}/yr. ${v.label}.`;
        return { signal: v.signal, label: t(v.label), detail };
    }, [history, zh, t]);

    // ── Inversion Metrics (NEW) ──
    const inversionData = useMemo(() => {
        const m = inversionMetrics(yieldSpread, history);
        if (!m.isInverted) return {
            signal: 'neutral',
            label: t('No Inversion'),
            detail: t('Yield curve is normal (10Y > 2Y). No recession signal from curve shape.'),
        };
        const detail = zh
            ? `倒挂持续 ${m.duration} 个季度。深度：${fmtPctAbs(m.depth)}。持续越久、越深，衰退概率越大。`
            : `Inverted for ${m.duration} quarter(s). Depth: ${fmtPctAbs(m.depth)}. Longer/deeper inversion = higher recession probability.`;
        let signal = 'warning';
        if (m.duration >= 4 && m.depth >= 1.0) signal = 'bearish';
        else if (m.duration >= 2) signal = 'warning';
        return { signal, label: t('CURVE INVERTED'), detail, depth: m.depth, duration: m.duration };
    }, [yieldSpread, history, zh, t]);

    // ── Cycle Phase Detector (NEW) ──
    const cyclePhaseData = useMemo(() => {
        const result = detectCyclePhase(effectivePrime, effectiveGNP, yieldSpread, history);
        if (result.phase === 0) {
            const need = Math.max(0, 2 - history.length);
            result.detail = zh
                ? `已有 ${history.length} 个季度快照，需至少 2 个季度进行周期检测。还需推进 ${need} 个季度。`
                : `Have ${history.length} snapshot(s), need 2+ for cycle detection. Advance ${need} more quarter(s).`;
        }
        return result;
    }, [effectivePrime, effectiveGNP, yieldSpread, history, zh]);

    // ── Per-Asset-Class Signals (NEW) ──
    // Combines macro context + price momentum for each tradable asset.
    const assetSignals = useMemo(() => {
        const phase = cyclePhaseData.phase;
        const carryPositive = carryTradeData.carry != null && carryTradeData.carry > 0;
        const carryNegative = carryTradeData.carry != null && carryTradeData.carry < 0;
        const curveInverted = yieldSpread != null && yieldSpread < 0;
        const creditStress = creditData.signal === 'bearish';
        const growthStrong = effectiveGNP != null && effectiveGNP > 2.5;
        const growthWeak = effectiveGNP != null && effectiveGNP < 1;
        const ratesHigh = effectivePrime != null && effectivePrime > 6;
        const ratesRising = cyclePhaseData.phase === 3;

        // Compute a single signal for an asset: { signal, action, detail }
        const sig = (s, action, detail) => ({ signal: s, action, detail });

        // --- Stock Index ---
        const stockIdx = (() => {
            if (phase === 1) return sig('bullish', 'OVERWEIGHT', zh ? '宽松期。低利率推动估值扩张。加仓股指期货。' : 'Easing cycle. Low rates drive valuation expansion. Buy index futures.');
            if (phase === 2) return sig('bullish', 'OVERWEIGHT', zh ? '复苏期。盈利增长加速。重仓股票。' : 'Recovery. Earnings growth accelerating. Overweight equities.');
            if (phase === 3 && ratesHigh) return sig('bearish', 'UNDERWEIGHT', zh ? '紧缩期+高利率。股票承压。减仓至防御性板块。' : 'Tightening + high rates. Equities under pressure. Reduce to defensive sectors.');
            if (phase === 4) return sig('bearish', 'AVOID', zh ? '衰退前期。曲线倒挂预示下跌。清仓等底。' : 'Pre-recession. Inverted curve signals decline. Sell, wait for bottom.');
            if (curveInverted) return sig('warning', 'REDUCE', zh ? '曲线倒挂。历史规律看跌。降低敞口。' : 'Curve inverted. Historically bearish. Reduce exposure.');
            if (growthWeak && ratesHigh) return sig('warning', 'CAUTIOUS', zh ? '低增长+高利率。双重打压。选择性做多。' : 'Low growth + high rates. Double headwind. Selective longs only.');
            return sig('neutral', 'HOLD', zh ? '信号矛盾。保持现有头寸。' : 'Mixed signals. Hold current positions.');
        })();

        // --- Gold ---
        const gold = (() => {
            const momUp = assetUp(api.GOLD_ID);
            if (creditStress || (curveInverted && phase === 4)) return sig('bullish', 'OVERWEIGHT', zh ? '信贷危机/衰退风险。终极避险资产。加仓黄金。' : 'Credit crisis / recession risk. Ultimate safe haven. Overweight gold.');
            if (ratesRising && ratesHigh) return sig('bullish', 'BUY', zh ? '高利率+紧缩。黄金对冲金融压抑。' : 'High rates + tightening. Gold hedges financial repression.');
            if (phase === 1) return sig('neutral', 'HOLD', zh ? '宽松期风险偏好回升。黄金暂歇。' : 'Easing: risk appetite returns. Gold may pause.');
            if (phase === 2 && growthStrong) return sig('warning', 'REDUCE', zh ? '强劲复苏。资金从避险流向增长资产。' : 'Strong recovery. Capital rotates from safety to growth.');
            if (momUp) return sig('bullish', 'BUY', zh ? '金价上涨趋势强。顺势做多。' : 'Gold uptrend intact. Ride momentum.');
            return sig('neutral', 'HOLD', zh ? '宏观中性。保持配置。' : 'Macro neutral. Maintain allocation.');
        })();

        // --- Silver ---
        const silver = (() => {
            if (phase === 2 && growthStrong) return sig('bullish', 'OVERWEIGHT', zh ? '复苏+工业需求。白银双重受益(贵金属+工业)。' : 'Recovery + industrial demand. Silver double-benefits (precious + industrial).');
            if (gold.signal === 'bullish' && growthStrong) return sig('bullish', 'BUY', zh ? '避险+工业双驱动。白银最佳环境。' : 'Safe haven + industrial dual driver. Best environment for silver.');
            if (gold.signal === 'bearish') return sig('bearish', 'REDUCE', zh ? '金价承压+工业放缓。双重利空。' : 'Gold under pressure + industrial slowdown. Double headwind.');
            return sig('neutral', 'HOLD', zh ? '跟随黄金和工业周期。中性。' : 'Tracking gold and industrial cycles. Neutral.');
        })();

        // --- Oil ---
        const oil = (() => {
            if (phase === 2 && growthStrong) return sig('bullish', 'OVERWEIGHT', zh ? '复苏期强劲需求。油价看涨。买入原油期货。' : 'Recovery drives demand. Bullish oil. Buy crude futures.');
            if (phase === 1) return sig('bullish', 'BUY', zh ? '宽松期流动性溢出。商品受益。' : 'Easing liquidity spillover. Commodities benefit.');
            if (phase === 3 && ratesHigh) return sig('warning', 'REDUCE', zh ? '紧缩压抑需求。油价承压。' : 'Tightening suppresses demand. Oil under pressure.');
            if (growthWeak || phase === 4) return sig('bearish', 'AVOID', zh ? '衰退/弱增长。需求崩溃。做空或回避。' : 'Recession/weak growth. Demand destruction. Short or avoid.');
            return sig('neutral', 'HOLD', zh ? '供给面主导。中性。' : 'Supply dynamics dominate. Neutral.');
        })();

        // --- Corn ---
        const corn = (() => {
            if (growthStrong && phase === 2) return sig('bullish', 'BUY', zh ? '经济强劲。农产品需求上升。' : 'Strong economy. Agricultural demand rising.');
            if (growthWeak || phase === 4) return sig('bearish', 'AVOID', zh ? '经济疲软。需求萎缩。回避。' : 'Weak economy. Demand contraction. Avoid.');
            if (creditStress) return sig('warning', 'REDUCE', zh ? '信贷紧缩影响农业融资。谨慎。' : 'Credit crunch impacts farm financing. Cautious.');
            return sig('neutral', 'HOLD', zh ? '季节性波动为主。中性。' : 'Seasonal. Neutral.');
        })();

        // --- Wheat ---
        const wheat = (() => {
            if (growthStrong && phase === 2) return sig('bullish', 'BUY', zh ? '经济扩张。粮食需求坚挺。' : 'Expansion. Grain demand firm.');
            if (growthWeak || phase === 4) return sig('bearish', 'AVOID', zh ? '需求萎缩。回避粮食多头。' : 'Demand contraction. Avoid grain longs.');
            if (creditStress) return sig('warning', 'REDUCE', zh ? '信贷紧缩。谨慎持仓。' : 'Credit crunch. Cautious.');
            return sig('neutral', 'HOLD', zh ? '中性。' : 'Neutral.');
        })();

        // --- Bitcoin ---
        const bitcoin = (() => {
            const momUp = assetUp(api.BITCOIN_ID);
            if (phase === 1) return sig('bullish', 'OVERWEIGHT', zh ? '宽松期流动性泛滥。加密货币最佳环境。重仓。' : 'Easing liquidity flood. Best crypto environment. Overweight.');
            if (phase === 3 && ratesHigh) return sig('bearish', 'AVOID', zh ? '紧缩+高利率。投机资产首当其冲。清仓加密货币。' : 'Tightening + high rates. Speculative assets hit first. Exit crypto.');
            if (carryNegative && ratesHigh) return sig('bearish', 'AVOID', zh ? '负套息+高利率。资金成本高。加密货币无吸引力。' : 'Negative carry + high rates. High funding cost. Crypto unattractive.');
            if (creditStress) return sig('bearish', 'REDUCE', zh ? '信贷危机。风险偏好崩溃。减仓。' : 'Credit crisis. Risk appetite collapse. Reduce.');
            if (momUp && carryPositive) return sig('bullish', 'BUY', zh ? '趋势向上+正利差。顺势做多。' : 'Uptrend + positive carry. Ride momentum.');
            return sig('neutral', 'HOLD', zh ? '信号矛盾。轻仓观望。' : 'Mixed signals. Light position, wait.');
        })();

        // --- Ethereum ---
        const ethereum = (() => {
            if (phase === 2 && growthStrong) return sig('bullish', 'OVERWEIGHT', zh ? '复苏+科技周期。ETH受益于链上活动。重仓。' : 'Recovery + tech cycle. ETH benefits from on-chain activity. Overweight.');
            if (bitcoin.signal === 'bearish') return sig('bearish', 'AVOID', zh ? '跟随BTC走弱。回避所有加密货币。' : 'Following BTC weakness. Avoid all crypto.');
            if (bitcoin.signal === 'bullish') return sig('bullish', 'BUY', zh ? 'BTC领涨。ETH跟涨且弹性更大。' : 'BTC leading. ETH follows with higher beta.');
            return sig('neutral', 'HOLD', zh ? '跟随BTC走势。中性。' : 'Tracking BTC. Neutral.');
        })();

        // --- Long Bond (10Y) ---
        const lBond = (() => {
            if (phase === 4 || (curveInverted && growthWeak)) return sig('bullish', 'OVERWEIGHT', zh ? '衰退前夜。最大久期。锁定9.79%高收益。等待降息后资本利得。' : 'Pre-recession. Max duration. Lock in high yields. Await capital gains when rates fall.');
            if (phase === 1) return sig('warning', 'REDUCE', zh ? '降息已开始。利率下行空间收窄。逐步减仓长债。' : 'Easing begun. Downside for rates narrowing. Reduce duration gradually.');
            if (ratesRising && ratesHigh) return sig('bullish', 'ACCUMULATE', zh ? '利率高位。逐步建仓长债。锁定高收益等待拐点。' : 'Rates at highs. Accumulate long bonds. Lock yields, wait for pivot.');
            if (carryNegative) return sig('bullish', 'HOLD', zh ? '负套息。但长债是"等降息"的头寸。持有。' : 'Negative carry. But long bonds are the "wait for cuts" trade. Hold.');
            return sig('neutral', 'HOLD', zh ? '久期中性。' : 'Duration neutral.');
        })();

        // --- Short Bond (2Y) ---
        const sBond = (() => {
            if (ratesRising && ratesHigh) return sig('bullish', 'BUY', zh ? '短端利率跟随央行。高carry。买入短期国债。' : 'Short end tracks central bank. High carry. Buy short bonds.');
            if (phase === 1) return sig('bearish', 'AVOID', zh ? '降息开始。短端利率将暴跌。转持长债捕捉资本利得。' : 'Cuts begun. Short rates will collapse. Rotate to long bonds for capital gains.');
            if (curveInverted) return sig('warning', 'REDUCE', zh ? '倒挂中。短端过高不可持续。' : 'Inverted. Short-end too high, unsustainable.');
            return sig('neutral', 'HOLD', zh ? '中性久期。' : 'Duration neutral.');
        })();

        return {
            stockIndex: { ...stockIdx, id: api.STOCK_INDEX_ID, label: zh ? '股指' : 'Stock Index', price: assetPrice(api.STOCK_INDEX_ID), chg: assetPctChange(api.STOCK_INDEX_ID) },
            gold:       { ...gold,       id: api.GOLD_ID,         label: zh ? '黄金' : 'Gold',       price: assetPrice(api.GOLD_ID),         chg: assetPctChange(api.GOLD_ID) },
            silver:     { ...silver,     id: api.SILVER_ID,       label: zh ? '白银' : 'Silver',     price: assetPrice(api.SILVER_ID),       chg: assetPctChange(api.SILVER_ID) },
            oil:        { ...oil,        id: api.OIL_ID,          label: zh ? '原油' : 'Oil',        price: assetPrice(api.OIL_ID),          chg: assetPctChange(api.OIL_ID) },
            corn:       { ...corn,       id: api.CORN_ID,         label: zh ? '玉米' : 'Corn',       price: assetPrice(api.CORN_ID),         chg: assetPctChange(api.CORN_ID) },
            wheat:      { ...wheat,      id: api.WHEAT_ID,        label: zh ? '小麦' : 'Wheat',      price: assetPrice(api.WHEAT_ID),        chg: assetPctChange(api.WHEAT_ID) },
            bitcoin:    { ...bitcoin,    id: api.BITCOIN_ID,      label: zh ? '比特币' : 'Bitcoin',   price: assetPrice(api.BITCOIN_ID),      chg: assetPctChange(api.BITCOIN_ID) },
            ethereum:   { ...ethereum,   id: api.ETHEREUM_ID,     label: zh ? '以太坊' : 'Ethereum',  price: assetPrice(api.ETHEREUM_ID),     chg: assetPctChange(api.ETHEREUM_ID) },
            longBond:   { ...lBond,      id: api.TBOND_RATE_ID,   label: t('Long Bond (10Y)'),        price: longBondRate,                     chg: null, isRate: true },
            shortBond:  { ...sBond,      id: api.SBOND_RATE_ID,   label: t('Short Bond (2Y)'),        price: shortBondRate,                    chg: null, isRate: true },
        };
    }, [cyclePhaseData, carryTradeData, yieldSpread, creditData, effectiveGNP, effectivePrime, zh, t,
        longBondRate, shortBondRate]);

    // ── Top picks from asset signals ──
    const topPicks = useMemo(() => {
        const list = Object.values(assetSignals).filter(a => a && a.signal);
        const overweight = list.filter(a => a.signal === 'bullish').sort((a, b) => (a.action === 'OVERWEIGHT' ? -1 : 1));
        const avoid = list.filter(a => a.signal === 'bearish').sort((a, b) => (a.action === 'AVOID' ? -1 : 1));
        return {
            overweight: overweight.slice(0, 3),
            avoid: avoid.slice(0, 2),
        };
    }, [assetSignals]);

    // ── Tax-adjusted indicators (FIXED: regex-parsed rates, no inflation) ──
    const taxData = useMemo(() => {
        const hasTaxData = indivTaxRate != null;
        const indivRate = indivTaxRate ?? 0;
        const cgRate = effectiveCapGainsRate ?? 0;
        const cgAdvantage = indivRate - cgRate;

        const afterTaxLongBond = longBondRate != null ? longBondRate * (1 - indivRate / 100) : null;
        const afterTaxShortBond = shortBondRate != null ? shortBondRate * (1 - indivRate / 100) : null;
        const afterTaxPrime = effectivePrime != null ? effectivePrime * (1 - indivRate / 100) : null;
        const afterTaxCarry = (afterTaxLongBond != null && afterTaxPrime != null) ? afterTaxLongBond - afterTaxPrime : null;
        const taxAdjGrowthYield = (effectiveGNP != null && afterTaxLongBond != null) ? effectiveGNP - afterTaxLongBond : null;

        const cgLabel = zh ? '资本利得税' : 'Cap Gains';
        const oiLabel = zh ? '普通所得税' : 'Ordinary Income';
        const taxTag = (isCG) => isCG
            ? { tag: 'CG', rate: cgRate, label: cgLabel, color: '#4ade80', detail: zh ? '优惠税率' : 'preferential' }
            : { tag: 'OI', rate: indivRate, label: oiLabel, color: '#f87171', detail: zh ? '全额征税' : 'fully taxed' };

        return {
            hasTaxData,
            corpTaxRate, indivTaxRate: indivRate, capGainsTaxRate: cgRate, cgAdvantage,
            afterTaxLongBond, afterTaxShortBond, afterTaxPrime, afterTaxCarry,
            taxAdjGrowthYield,
            equityTaxTag: taxTag(true),
            bondTaxTag: taxTag(false),
            reportedGDP, reportedPrime,
            wealthTaxProjected, corpSharesTax, wealthTaxNone,
        };
    }, [indivTaxRate, effectiveCapGainsRate, corpTaxRate, longBondRate, shortBondRate, effectivePrime,
        effectiveGNP, reportedGDP, reportedPrime, wealthTaxProjected, corpSharesTax, zh]);

    // ── Cache tax & policy data across view switches ──
    // The engine clears economicDataReport/advisorySummary when navigating
    // away from those views. We persist the last successfully parsed values.
    useEffect(() => {
        if (taxData.hasTaxData) setCachedTax(taxData);
    }, [taxData.hasTaxData, taxData.indivTaxRate, taxData.capGainsTaxRate, taxData.corpTaxRate]);
    useEffect(() => {
        if (policyData) setCachedPolicy(policyData);
    }, [policyData?.stance]);

    // Use cached values when live data is unavailable
    const effectiveTax = taxData.hasTaxData ? taxData : cachedTax;
    const effectivePolicy = policyData ?? cachedPolicy;

    // ── Composite recommendation (enhanced with cycle phase) ──
    const compositeSignal = useMemo(() => {
        const signals = [
            yieldCurveSignal?.signal,
            growthYieldData?.signal,
            macroData?.signal,
            creditData?.signal,
            carryTradeData?.signal,
            curveDirData?.signal,
            velocityData?.signal,
        ];
        const bearCount = signals.filter(s => s === 'bearish').length;
        const bullCount = signals.filter(s => s === 'bullish').length;
        const warnCount = signals.filter(s => s === 'warning').length;

        // Incorporate cycle phase into recommendation
        const cyclePhase = cyclePhaseData.phase;

        if (cyclePhase === 1) { // Easing — best environment
            return {
                type: 'buy',
                title: t('AGGRESSIVE — FULL RISK-ON (Easing Cycle)'),
                body: zh
                    ? '周期阶段：宽松期。全面绿灯。低利率发行长期债务。收购实物资产和股票。高杠杆运行。这是"低息买资产"的黄金窗口。'
                    : 'Cycle Phase: EASING. All systems green. Issue long-dated debt at low rates. Acquire real assets and equities. Run high leverage. This is the "low rates buy assets" golden window.',
            };
        }
        if (cyclePhase === 4) { // Pre-recession — defensive opportunity
            return {
                type: 'sell',
                title: t('DEFENSIVE — PREPARE FOR OPPORTUNITY (Pre-Recession)'),
                body: zh
                    ? '周期阶段：衰退前期。收益率曲线倒挂。卖出风险资产，买入长期国债锁定高收益。准备困境资产观察清单。等待央行降息后部署现金。这是"高息开银行买债"的阶段。'
                    : 'Cycle Phase: PRE-RECESSION. Yield curve inverted. Sell risk assets, buy long bonds to lock in high yields. Prepare distressed-asset shopping list. Deploy cash after the central bank pivots. This is the "open a bank, buy bonds" phase.',
            };
        }
        if (bearCount >= 3) return {
            type: 'sell',
            title: t('DEFENSIVE — MAXIMUM CAUTION'),
            body: zh
                ? '多项指标亮红灯。清仓风险资产，转投长期国债。保全资本。等待周期见底后再将现金部署到困境资产中。'
                : 'Multiple indicators flashing RED. Liquidate risk assets, move to long-dated government bonds. Preserve capital. Wait for the cycle to bottom before deploying cash into distressed assets.',
        };
        if (bearCount >= 2) return {
            type: 'sell',
            title: t('Bearish Tilt — Reduce Risk'),
            body: zh
                ? '多数指标偏空。卖出股票，缩短久期。开始积累长期债券。准备优质资产观察清单，以待低价收购。'
                : 'Majority of indicators are bearish. Sell equities, shorten duration. Begin accumulating long bonds. Prepare watchlist of quality assets to acquire at distressed prices.',
        };
        if (bullCount >= 3) return {
            type: 'buy',
            title: t('Bullish Tilt — Risk-On'),
            body: zh
                ? '多数指标有利。股票优于债券。考虑杠杆收购。监控收益率曲线倒挂信号以择机退出。'
                : 'Most indicators favorable. Favor equities over bonds. Consider leveraged acquisitions. Monitor yield curve for any inversion signal to exit.',
        };
        if (warnCount >= 2) return {
            type: 'hold',
            title: t('Transition Zone — Stay Nimble'),
            body: zh
                ? '指标矛盾。拐点可能临近。持有现有头寸。不要开立大额新仓位。每日关注收益率曲线和GDP数据以捕捉转向信号。'
                : 'Indicators are mixed. The inflection point may be near. Hold current positions. Do NOT initiate large new bets. Watch yield curve and GDP data daily for the pivot signal.',
        };
        return {
            type: 'hold',
            title: t('Mixed Signals — Wait for Clarity'),
            body: zh
                ? '指标不一致。维持均衡组合。聪明钱等确认信号后才部署资金。'
                : 'Indicators are not aligned. Maintain balanced portfolio. The smart money waits for confirmation before committing capital.',
        };
    }, [yieldCurveSignal, growthYieldData, macroData, creditData, carryTradeData, curveDirData, velocityData, cyclePhaseData, zh, t]);

    // ── Cycle Playbook (context-aware) ──
    const playbook = useMemo(() => {
        const phase = cyclePhaseData.phase;
        if (zh) {
            const items = [
                { phase: 1, title: '宽松期', icon: '\u{1F4C8}',
                    desc: '发行长期债务 → 买入实物资产和股票 → 高杠杆 → "低息买资产"',
                    key: 'Best entry: build leveraged positions. Carry trade is maximally profitable. Duration: go long.' },
                { phase: 2, title: '复苏期', icon: '\u{1F680}',
                    desc: '债券轮动至股票 → 收购周期性资产 → 维持适度杠杆 → 监控紧缩信号',
                    key: 'Rotation from bonds to equities. Cyclical sectors outperform. Watch for first signs of tightening.' },
                { phase: 3, title: '紧缩期', icon: '⚠',
                    desc: '降低久期 → 卖出利率敏感资产 → 积累现金 → 筛选困境收购目标',
                    key: 'Reduce duration. Sell rate-sensitive assets. Build cash. Screen for distressed-sale targets.' },
                { phase: 4, title: '衰退前期', icon: '\u{1F4C9}',
                    desc: '最大长久期 → 卖出风险资产 → 买入长债锁定高收益 → "别人恐惧我贪婪"',
                    key: 'Maximum long-bond duration. Sell risk. Lock in high yields. Prepare to buy distressed quality assets.' },
            ];
            return items.map((item, i) => ({
                ...item,
                active: (i + 1) === phase,
                border: (i + 1) === phase ? '#f3f4f6' : 'rgba(255,255,255,0.1)',
                bg: (i + 1) === phase ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.02)',
                titleColor: (i + 1) === phase ? '#f3f4f6' : '#9ca3af',
                descColor: (i + 1) === phase ? '#d1d5db' : '#6b7280',
            }));
        }
        const items = [
            { phase: 1, title: 'Easing', icon: '\u{1F4C8}',
                desc: 'Issue long-dated debt → Buy real assets & equities → Run high leverage → "Low rates buy assets"',
                key: 'Best entry: build leveraged positions. Carry trade is maximally profitable. Duration: go long.' },
            { phase: 2, title: 'Recovery', icon: '\u{1F680}',
                desc: 'Rotate bonds → equities → Acquire cyclical assets → Moderate leverage → Watch for tightening signs',
                key: 'Rotation from bonds to equities. Cyclical sectors outperform. Watch for first signs of tightening.' },
            { phase: 3, title: 'Tightening', icon: '⚠',
                desc: 'Reduce duration → Sell rate-sensitive assets → Build cash → Screen distressed targets',
                key: 'Reduce duration. Sell rate-sensitive assets. Build cash. Screen for distressed-sale targets.' },
            { phase: 4, title: 'Pre-Recession', icon: '\u{1F4C9}',
                desc: 'Max long-bond duration → Sell risk assets → Lock high yields → "Be greedy when others are fearful"',
                key: 'Maximum long-bond duration. Sell risk. Lock in high yields. Prepare to buy distressed quality assets.' },
        ];
        return items.map((item, i) => ({
            ...item,
            active: (i + 1) === phase,
            border: (i + 1) === phase ? '#f3f4f6' : 'rgba(255,255,255,0.1)',
            bg: (i + 1) === phase ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.02)',
            titleColor: (i + 1) === phase ? '#f3f4f6' : '#9ca3af',
            descColor: (i + 1) === phase ? '#d1d5db' : '#6b7280',
        }));
    }, [cyclePhaseData, zh]);

    // ── Data gaps ──
    const dataGaps = [];
    if (longBondRate == null) dataGaps.push(t('Long Bond Rate'));
    if (shortBondRate == null) dataGaps.push(t('Short Bond Rate'));
    if (effectiveGNP == null) dataGaps.push(t('GDP Growth Rate'));
    if (effectivePrime == null) dataGaps.push(t('Prime Rate'));

    // ── Section header clickable component ──
    const SectionHeader = ({ id, label }) => html`
        <div onClick=${() => toggle(id)}
             style="display:flex; align-items:center; gap:6px; cursor:pointer; font-size:11px; font-weight:600; color:#6b7280; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:${sections[id] ? '8px' : '0'}; user-select:none; padding:4px 0;">
            <span style="font-size:10px;">${sections[id] ? '▼' : '▶'}</span> ${label}
        </div>
    `;

    if (!gameLoaded || !show) return null;

    // ── History table data (last 8 entries, reversed = newest first) ──
    const historyRows = history.slice(-8).reverse();

    return html`
        <${Modal} show=${show} onClose=${onClose} hideHintLightbulb=${true} class="modal-card" style=${{ "--modal-w": "680px", "--modal-h": "auto", maxHeight: "90vh" }}>
            <div style="display:flex; flex-direction:column; max-height:90vh;">
                <!-- HEADER -->
                <div style="display:flex; align-items:center; justify-content:space-between; padding:14px 16px; border-bottom:1px solid rgba(255,255,255,0.1); flex-shrink:0;">
                    <div>
                        <div style="font-size:16px; font-weight:700; color:#f3f4f6;">${t('Macro Cycle Indicators')}</div>
                        <div style="font-size:11px; color:#6b7280; margin-top:2px;">
                            ${t('Q')}${currentQuarter || '?'} ${currentYear || '----'} ${t('—')} ${t('Bridgewater-style Four-Quadrant Analysis')}
                            ${history.length > 0 ? html`<span style="color:#4ade80; margin-left:6px;">(${history.length} ${zh ? '个季度快照' : 'quarterly snapshots'})</span>` : ''}
                        </div>
                    </div>
                    <${Button} class="btn main-menu" onClick=${onClose}>${t('Close')}</${Button}>
                </div>

                <!-- BODY (scrollable) -->
                <div style="overflow-y:auto; padding:14px 16px; flex:1;">

                    ${dataGaps.length > 0 ? html`
                        <div style="background:rgba(234,179,8,0.1); border:1px solid rgba(234,179,8,0.3); border-radius:6px; padding:8px 12px; margin-bottom:12px; font-size:11px; color:#facc15;">
                            <strong>${t('⚠ Missing data:')}</strong> ${dataGaps.join(', ')}${t(' — Open Market → Economic Data or Interest Rates reports to populate these values. You can also add rates to Streaming Quotes for live updates.')}
                        </div>
                    ` : ''}

                    <!-- ═══ SECTION: KEY RATES DASHBOARD (3×3 grid) ═══ -->
                    <${SectionHeader} id="rates" label=${t('Key Rates Dashboard')} />
                    ${sections.rates ? html`
                        <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:4px; margin-bottom:14px;">
                            <div style="background:rgba(255,255,255,0.03); border-radius:4px; padding:6px 10px;">
                                <div style="color:#9ca3af; font-size:10px;">${t('Long Bond (10Y)')}</div>
                                <div style="font-weight:600; font-size:13px; color:#f3f4f6; font-family:monospace;">
                                    ${longBondRate != null ? fmtPctAbs(longBondRate) : t('N/A')}
                                    ${(() => { const da = deltaArrow(longBondRate, lbOld); return da ? html`<span style="color:${da.color}; font-size:10px;"> ${da.arrow}</span>` : ''; })()}
                                </div>
                            </div>
                            <div style="background:rgba(255,255,255,0.03); border-radius:4px; padding:6px 10px;">
                                <div style="color:#9ca3af; font-size:10px;">${t('Short Bond (2Y)')}</div>
                                <div style="font-weight:600; font-size:13px; color:#f3f4f6; font-family:monospace;">
                                    ${shortBondRate != null ? fmtPctAbs(shortBondRate) : t('N/A')}
                                    ${(() => { const da = deltaArrow(shortBondRate, sbOld); return da ? html`<span style="color:${da.color}; font-size:10px;"> ${da.arrow}</span>` : ''; })()}
                                </div>
                            </div>
                            <div style="background:rgba(255,255,255,0.03); border-radius:4px; padding:6px 10px;">
                                <div style="color:#9ca3af; font-size:10px;">${t('Prime Rate')}</div>
                                <div style="font-weight:600; font-size:13px; color:#f3f4f6; font-family:monospace;">
                                    ${effectivePrime != null ? fmtPctAbs(effectivePrime) : t('N/A')}
                                    ${(() => { const da = deltaArrow(effectivePrime, prOld); return da ? html`<span style="color:${da.color}; font-size:10px;"> ${da.arrow}</span>` : ''; })()}
                                </div>
                            </div>
                            <div style="background:rgba(255,255,255,0.03); border-radius:4px; padding:6px 10px;">
                                <div style="color:#9ca3af; font-size:10px;">${t('GDP Growth')}</div>
                                <div style="font-weight:600; font-size:13px; color:#f3f4f6; font-family:monospace;">${effectiveGNP != null ? fmtPct(effectiveGNP) : t('N/A')}</div>
                            </div>
                            <div style="background:rgba(255,255,255,0.03); border-radius:4px; padding:6px 10px;">
                                <div style="color:#9ca3af; font-size:10px;">${t('Curve Spread (10Y−2Y)')}</div>
                                <div style="font-weight:600; font-size:13px; color:${yieldSpread != null ? (yieldSpread >= 0 ? '#4ade80' : '#f87171') : '#9ca3af'}; font-family:monospace;">${yieldSpread != null ? fmtPct(yieldSpread) : t('N/A')}</div>
                                <div style="font-size:8px; color:#6b7280; margin-top:1px;">${longBondRate != null ? fmtPctAbs(longBondRate) : '?'} − ${shortBondRate != null ? fmtPctAbs(shortBondRate) : '?'}</div>
                            </div>
                            <div style="background:rgba(255,255,255,0.03); border-radius:4px; padding:6px 10px;">
                                <div style="color:#9ca3af; font-size:10px;">${t('Carry Trade Space')}</div>
                                <div style="font-weight:600; font-size:13px; color:${carryTradeData.carry != null ? (carryTradeData.carry >= 0 ? '#4ade80' : '#f87171') : '#9ca3af'}; font-family:monospace;">${carryTradeData.carry != null ? fmtPct(carryTradeData.carry) : t('N/A')}</div>
                                <div style="font-size:8px; color:#6b7280; margin-top:1px;">${zh ? '借基准' : 'Borrow@'}${effectivePrime != null ? fmtPctAbs(effectivePrime) : '?'} → ${zh ? '买10Y' : 'Buy@'}${longBondRate != null ? fmtPctAbs(longBondRate) : '?'}</div>
                            </div>
                            <!-- Row 3: Tax rates & after-tax carry -->
                            <div style="background:rgba(255,255,255,0.03); border-radius:4px; padding:6px 10px;">
                                <div style="color:#9ca3af; font-size:10px;">${zh ? '个人所得税' : 'Indiv. Tax'}</div>
                                <div style="font-weight:600; font-size:13px; color:#f3f4f6; font-family:monospace;">${effectiveTax?.indivTaxRate > 0 ? fmtPctAbs(effectiveTax?.indivTaxRate) : t('N/A')}</div>
                            </div>
                            <div style="background:rgba(255,255,255,0.03); border-radius:4px; padding:6px 10px;">
                                <div style="color:#9ca3af; font-size:10px;">${zh ? '资本利得税' : 'Cap Gains Tax'}</div>
                                <div style="font-weight:600; font-size:13px; color:${effectiveTax?.capGainsTaxRate > 0 && effectiveTax?.capGainsTaxRate < effectiveTax?.indivTaxRate ? '#4ade80' : '#f3f4f6'}; font-family:monospace;">
                                    ${effectiveTax?.capGainsTaxRate > 0 ? fmtPctAbs(effectiveTax?.capGainsTaxRate) : (effectiveTax?.indivTaxRate > 0 ? '~' + fmtPctAbs(effectiveTax?.indivTaxRate * 0.5) : t('N/A'))}
                                </div>
                            </div>
                            <div style="background:rgba(255,255,255,0.03); border-radius:4px; padding:6px 10px;">
                                <div style="color:#9ca3af; font-size:10px;">${zh ? '税后套息' : 'After-Tax Carry'}</div>
                                <div style="font-weight:600; font-size:13px; color:${effectiveTax?.afterTaxCarry != null ? (effectiveTax?.afterTaxCarry >= 0 ? '#4ade80' : '#f87171') : '#9ca3af'}; font-family:monospace;">${effectiveTax?.afterTaxCarry != null ? fmtPct(effectiveTax?.afterTaxCarry) : t('N/A')}</div>
                                <div style="font-size:8px; color:#6b7280; margin-top:1px;">(${zh ? '10Y' : '10Y'}−${zh ? '基准' : 'Prime'}) × (1−${effectiveTax?.indivTaxRate > 0 ? fmtPctAbs(effectiveTax?.indivTaxRate) : '?'})</div>
                            </div>
                        </div>
                    ` : ''}

                    <!-- ═══ SECTION: YIELD CURVE ANALYSIS ═══ -->
                    <${SectionHeader} id="curve" label=${t('Yield Curve Analysis')} />
                    ${sections.curve ? html`
                        <div style="margin-bottom:12px;">
                            <div style="margin-bottom:6px;">
                                <div style="font-size:11px; font-weight:600; color:#9ca3af; margin-bottom:3px;">${zh ? '核心利差' : 'Core Spread'}</div>
                                <${SignalBadge} signal=${yieldCurveSignal.signal} label=${yieldCurveSignal.label} detail=${yieldCurveSignal.detail} size="compact" />
                            </div>
                            <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px;">
                                <div>
                                    <div style="font-size:10px; font-weight:600; color:#6b7280; margin-bottom:2px;">${t('Curve Direction')}</div>
                                    <${SignalBadge} signal=${curveDirData.signal} label=${curveDirData.label} detail=${curveDirData.detail} size="compact" />
                                </div>
                                <div>
                                    <div style="font-size:10px; font-weight:600; color:#6b7280; margin-bottom:2px;">${t('Re-Steepening Velocity')}</div>
                                    <${SignalBadge} signal=${velocityData.signal} label=${velocityData.label} detail=${velocityData.detail} size="compact" />
                                </div>
                            </div>
                            ${history.length >= 2 ? html`
                                <div style="margin-top:6px;">
                                    <div style="font-size:10px; font-weight:600; color:#6b7280; margin-bottom:2px;">${t('Inversion Depth & Duration')}</div>
                                    <${SignalBadge} signal=${inversionData.signal} label=${inversionData.label} detail=${inversionData.detail} size="compact" />
                                </div>
                            ` : ''}
                        </div>
                    ` : ''}

                    <!-- ═══ SECTION: GROWTH & CREDIT MONITOR ═══ -->
                    <${SectionHeader} id="growth" label=${t('Growth & Credit Monitor')} />
                    ${sections.growth ? html`
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; margin-bottom:12px;">
                            <div>
                                <div style="font-size:10px; font-weight:600; color:#6b7280; margin-bottom:2px;">${t('Growth-Yield Differential')}</div>
                                <${SignalBadge} signal=${growthYieldData.signal} label=${growthYieldData.label} detail=${growthYieldData.detail || ''} size="compact" />
                            </div>
                            <div>
                                <div style="font-size:10px; font-weight:600; color:#6b7280; margin-bottom:2px;">${t('Sahm Rule / GDP Recession Signal')}</div>
                                <${SignalBadge} signal=${macroData.signal} label=${macroData.label} detail=${macroData.detail} size="compact" />
                            </div>
                            <div>
                                <div style="font-size:10px; font-weight:600; color:#6b7280; margin-bottom:2px;">${t('Credit Stress')}</div>
                                <${SignalBadge} signal=${creditData.signal} label=${creditData.label} detail=${creditData.detail} size="compact" />
                            </div>
                            <div>
                                <div style="font-size:10px; font-weight:600; color:#6b7280; margin-bottom:2px;">${t('Carry Trade Space')}</div>
                                <${SignalBadge} signal=${carryTradeData.signal} label=${carryTradeData.label} detail=${carryTradeData.detail} size="compact" />
                            </div>
                        </div>
                    ` : ''}

                    <!-- ═══ SECTION: 4-STAGE CYCLE PHASE DETECTOR ═══ -->
                    <${SectionHeader} id="cycle" label=${t('Four-Stage Cycle Phase Detector')} />
                    ${sections.cycle ? html`
                        <div style="margin-bottom:12px; padding:10px 12px; background:rgba(255,255,255,0.03); border-radius:8px; border:1px solid rgba(255,255,255,0.08);">
                            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">
                                <span style="font-size:13px; font-weight:700; color:#f3f4f6;">${zh ? '当前阶段：' : 'Current Phase: '}${cyclePhaseData.phase >= 1 ? t(cyclePhaseData.label) : t('Insufficient History')}</span>
                                <span style="font-size:11px; color:#6b7280;">${zh ? '(基于历史趋势)' : '(based on historical trends)'}</span>
                            </div>
                            <${PhaseBar} phase=${cyclePhaseData.phase} zh=${zh} />
                            ${cyclePhaseData.detail ? html`
                                <div style="margin-top:8px; font-size:11px; color:#9ca3af; line-height:1.4;">${cyclePhaseData.detail}</div>
                            ` : ''}
                            <!-- Central Bank Monetary Policy -->
                            ${effectivePolicy ? html`
                                <div style="margin-top:8px; padding:6px 8px; background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.06); border-radius:4px;">
                                    <div style="display:flex; align-items:center; gap:6px;">
                                        <span style="font-size:10px;">🏛</span>
                                        <span style="font-size:10px; font-weight:600; color:#e5e7eb;">${zh ? '央行政策' : 'Central Bank Policy'}:</span>
                                        <span style="font-size:10px; font-weight:700; color:${effectivePolicy.signal === 'bullish' ? '#4ade80' : effectivePolicy.signal === 'bearish' ? '#f87171' : '#facc15'};">${effectivePolicy.stance}</span>
                                    </div>
                                    <div style="font-size:9px; color:#9ca3af; margin-top:3px; line-height:1.3;">${effectivePolicy.desc}</div>
                                    ${cyclePhaseData.phase >= 1 ? html`
                                        <div style="font-size:9px; margin-top:3px; color:${(effectivePolicy.signal === 'bullish' && cyclePhaseData.phase === 3) || (effectivePolicy.signal === 'bearish' && cyclePhaseData.phase === 1) ? '#f97316' : '#6b7280'};">
                                            ${(effectivePolicy.signal === 'bullish' && cyclePhaseData.phase >= 3)
                                                ? (zh ? '⚠ 政策信号领先于数据。周期相位可能即将转向。' : '⚠ Policy signal leading data. Cycle phase may pivot soon.')
                                                : (effectivePolicy.signal === 'bearish' && cyclePhaseData.phase <= 2)
                                                ? (zh ? '⚠ 政策紧缩与早期周期矛盾。关注拐点。' : '⚠ Tightening policy conflicts with early cycle. Watch for inflection.')
                                                : (zh ? '✓ 政策立场与周期相位一致。' : '✓ Policy stance aligns with cycle phase.')}
                                        </div>
                                    ` : ''}
                                </div>
                            ` : html`
                                <div style="margin-top:8px; padding:6px 8px; background:rgba(234,179,8,0.06); border:1px solid rgba(234,179,8,0.15); border-radius:4px; text-align:center;">
                                    <div style="font-size:9px; color:#facc15; font-weight:600;">${zh ? '央行政策数据不可用' : 'Central Bank Policy Unavailable'}</div>
                                    <div style="font-size:8px; color:#9ca3af; margin-top:2px;">${zh ? '请打开"Research → Advisory Summary"获取央行货币政策信息。数据将自动缓存。' : 'Open "Research → Advisory Summary" to load monetary policy. Data is cached once fetched.'}</div>
                                </div>
                            `}
                        </div>
                    ` : ''}

                    <!-- ═══ SECTION: TAX & REAL RATES ═══ -->
                    <${SectionHeader} id="tax" label=${zh ? '税务与实际利率' : 'Tax & Real Rates'} />
                    ${sections.tax !== false ? html`
                        <div style="margin-bottom:12px;">
                            ${!effectiveTax ? html`
                                <div style="padding:10px 12px; background:rgba(234,179,8,0.08); border:1px solid rgba(234,179,8,0.25); border-radius:6px; margin-bottom:8px; text-align:center;">
                                    <div style="font-size:12px; color:#facc15; font-weight:600; margin-bottom:4px;">${zh ? '税务数据不可用' : 'Tax Data Unavailable'}</div>
                                    <div style="font-size:10px; color:#9ca3af; line-height:1.5;">${zh ? '请打开"Research → Economic Data"获取税率信息。数据将自动缓存供后续查看。' : 'Open "Research → Economic Data" to load tax rate data. Once fetched, data is cached for offline viewing.'}</div>
                                </div>
                            ` : html`
                            <!-- Tax rate row -->
                            <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:4px; margin-bottom:8px;">
                                <div style="background:rgba(255,255,255,0.03); border-radius:4px; padding:6px 8px; text-align:center;">
                                    <div style="font-size:9px; color:#6b7280;">${zh ? '企业所得税' : 'Corporate Tax'}</div>
                                    <div style="font-size:12px; font-weight:700; color:#f3f4f6;">${effectiveTax?.corpTaxRate != null ? fmtPctAbs(effectiveTax?.corpTaxRate) : t('N/A')}</div>
                                </div>
                                <div style="background:rgba(255,255,255,0.03); border-radius:4px; padding:6px 8px; text-align:center;">
                                    <div style="font-size:9px; color:#6b7280;">${zh ? '个人所得税' : 'Individual Tax'}</div>
                                    <div style="font-size:12px; font-weight:700; color:#f3f4f6;">${effectiveTax?.indivTaxRate > 0 ? fmtPctAbs(effectiveTax?.indivTaxRate) : t('N/A')}</div>
                                </div>
                                <div style="background:rgba(255,255,255,0.03); border-radius:4px; padding:6px 8px; text-align:center;">
                                    <div style="font-size:9px; color:#6b7280;">${zh ? '资本利得税' : 'Cap Gains Tax'}</div>
                                    <div style="font-size:12px; font-weight:700; color:${effectiveTax?.capGainsTaxRate > 0 && effectiveTax?.capGainsTaxRate < effectiveTax?.indivTaxRate ? '#4ade80' : '#f3f4f6'};">
                                        ${effectiveTax?.capGainsTaxRate > 0 ? fmtPctAbs(effectiveTax?.capGainsTaxRate) : (effectiveTax?.indivTaxRate > 0 ? '~' + fmtPctAbs(effectiveTax?.indivTaxRate * 0.5) + ' (est)' : t('N/A'))}
                                    </div>
                                </div>
                            </div>

                            ${effectiveTax?.cgAdvantage > 0 ? html`
                                <div style="background:rgba(34,197,94,0.08); border:1px solid rgba(34,197,94,0.2); border-radius:4px; padding:5px 8px; margin-bottom:8px; font-size:10px; color:#4ade80;">
                                    ${zh ? `资本利得税优惠：普通所得税 ${fmtPctAbs(effectiveTax?.indivTaxRate)} − 资本利得税 ${fmtPctAbs(effectiveTax?.capGainsTaxRate)} = ${fmtPctAbs(effectiveTax?.cgAdvantage)} 税收优势。股票、商品、加密货币享有此优惠。` : `Capital gains advantage: Ordinary ${fmtPctAbs(effectiveTax?.indivTaxRate)} − CG ${fmtPctAbs(effectiveTax?.capGainsTaxRate)} = ${fmtPctAbs(effectiveTax?.cgAdvantage)} tax savings. Stocks, commodities, crypto benefit.`}
                                </div>
                            ` : ''}

                            <!-- After-tax yields -->
                            <div style="display:grid; grid-template-columns:1fr 1fr; gap:4px; margin-bottom:8px;">
                                <div style="background:rgba(255,255,255,0.02); border-radius:4px; padding:5px 8px;">
                                    <div style="font-size:9px; color:#6b7280;">${zh ? '10Y 名义收益率' : '10Y Nominal'}</div>
                                    <div style="font-size:11px; font-weight:600; color:#f3f4f6;">${longBondRate != null ? fmtPctAbs(longBondRate) : t('N/A')}</div>
                                </div>
                                <div style="background:rgba(255,255,255,0.02); border-radius:4px; padding:5px 8px;">
                                    <div style="font-size:9px; color:#6b7280;">${zh ? '10Y 税后收益率' : '10Y After-Tax'} = ${longBondRate != null ? fmtPctAbs(longBondRate) : '?'} × (1−${effectiveTax?.indivTaxRate > 0 ? fmtPctAbs(effectiveTax?.indivTaxRate) : '?'})</div>
                                    <div style="font-size:11px; font-weight:600; color:${effectiveTax?.afterTaxLongBond != null ? '#f97316' : '#9ca3af'};">
                                        ${effectiveTax?.afterTaxLongBond != null ? fmtPctAbs(effectiveTax?.afterTaxLongBond) : t('N/A')}
                                        ${effectiveTax?.afterTaxLongBond != null && longBondRate != null ? html`<span style="font-size:9px; color:#6b7280;"> (${zh ? '税后实得' : 'net'})</span>` : ''}
                                    </div>
                                </div>
                            </div>

                            <!-- Other taxes status -->
                            <div style="font-size:9px; color:#6b7280; margin-bottom:4px;">
                                ${effectiveTax?.wealthTaxNone ? (zh ? '财富税：未征收' : 'Wealth Tax: (NONE)') : (effectiveTax?.wealthTaxProjected != null && effectiveTax?.wealthTaxProjected > 0 ? html`<span style="color:#f87171;">${zh ? '财富税：已征收' : 'Wealth Tax: ACTIVE'}</span>` : '')}
                                ${effectiveTax?.wealthTaxNone || (effectiveTax?.wealthTaxProjected != null) ? ' • ' : ''}
                                ${effectiveTax?.corpSharesTax > 0 ? html`<span style="color:#fb923c;">${zh ? '公司股票税：$' : 'Corp Shares Tax: $'}${Math.round(effectiveTax?.corpSharesTax).toLocaleString()}</span>` : (zh ? '公司股票税：(无)' : 'Corp Shares Tax: (NONE)')}
                            </div>

                            <!-- Wealth tax warning (Difficulty 4) -->
                            ${effectiveTax?.wealthTaxProjected != null && effectiveTax?.wealthTaxProjected > 0 ? html`
                                <div style="background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.3); border-radius:4px; padding:6px 8px; margin-bottom:6px; font-size:10px; color:#f87171;">
                                    <strong>${zh ? '⚠ 财富税警告' : '⚠ Wealth Tax Alert'}</strong> ${zh ? `预计年度财富税：$${Math.round(effectiveTax?.wealthTaxProjected).toLocaleString()}。考虑将资产转移至免税实体或降低应税净资产。` : `Projected annual wealth tax: $${Math.round(effectiveTax?.wealthTaxProjected).toLocaleString()}. Consider moving assets to tax-exempt entities.`}
                                </div>
                            ` : ''}

                            ${effectiveTax?.corpSharesTax != null && effectiveTax?.corpSharesTax > 0 ? html`
                                <div style="background:rgba(249,115,22,0.1); border:1px solid rgba(249,115,22,0.3); border-radius:4px; padding:5px 8px; font-size:10px; color:#fb923c;">
                                    <strong>${zh ? '⚠ 公司股票税' : '⚠ Corp Shares Tax'}</strong> ${zh ? `年度公司股票持有税：$${Math.round(effectiveTax?.corpSharesTax).toLocaleString()}` : `Annual corp shares tax: $${Math.round(effectiveTax?.corpSharesTax).toLocaleString()}`}
                                </div>
                            ` : ''}
                            `}
                        </div>
                    ` : ''}

                    <!-- ═══ SECTION: ASSET CLASS SIGNALS ═══ -->
                    <${SectionHeader} id="assets" label=${t('Asset Class Signals')} />
                    ${sections.assets !== false ? html`
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:5px; margin-bottom:12px;">
                            ${['stockIndex','gold','silver','oil','corn','wheat','bitcoin','ethereum','longBond','shortBond'].map(key => {
                                const a = assetSignals[key];
                                if (!a) return '';
                                const sc = { bullish:'#4ade80', bearish:'#f87171', warning:'#f97316', neutral:'#facc15' };
                                const color = sc[a.signal] || '#9ca3af';
                                const priceStr = a.isRate ? fmtPctAbs(a.price) : (a.price != null ? (a.price >= 1000 ? (a.price >= 1e6 ? (a.price/1e6).toFixed(2)+'M' : (a.price/1000).toFixed(0)+'k') : a.price.toFixed(2)) : 'N/A');
                                const chgStr = a.chg != null ? ((a.chg >= 0 ? '+' : '') + a.chg.toFixed(1) + '%') : '';
                                const chgColor = a.chg != null ? (a.chg >= 0 ? '#4ade80' : '#f87171') : '#6b7280';
                                const isRateAsset = key === 'longBond' || key === 'shortBond';
                                const isBondAsset = isRateAsset;
                                const taxTag = isBondAsset ? effectiveTax?.bondTaxTag : effectiveTax?.equityTaxTag;
                                const afterTaxStr = isBondAsset && effectiveTax?.afterTaxLongBond != null && key === 'longBond'
                                    ? fmtPctAbs(effectiveTax?.afterTaxLongBond)
                                    : (isBondAsset && effectiveTax?.afterTaxShortBond != null && key === 'shortBond'
                                        ? fmtPctAbs(effectiveTax?.afterTaxShortBond) : null);
                                return html`
                                    <div style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.06); border-radius:6px; padding:7px 9px;">
                                        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:3px;">
                                            <span style="font-size:11px; font-weight:600; color:#e5e7eb;">${a.label}</span>
                                            <div style="display:flex; align-items:center; gap:4px;">
                                                ${effectiveTax?.hasTaxData ? html`<span style="font-size:8px; font-weight:600; color:${taxTag.color}; background:rgba(255,255,255,0.04); border-radius:3px; padding:1px 3px;" title=${taxTag.label + ' (' + fmtPctAbs(taxTag.rate) + ')'}>${taxTag.tag}</span>` : ''}
                                                <span style="font-size:10px; font-weight:700; color:${color}; white-space:nowrap;">${t(a.action)}</span>
                                            </div>
                                        </div>
                                        <div style="display:flex; align-items:center; gap:6px; margin-bottom:3px;">
                                            <span style="font-size:12px; font-weight:700; color:#f3f4f6; font-family:monospace;">${priceStr}</span>
                                            ${chgStr ? html`<span style="font-size:10px; color:${chgColor};">${chgStr}</span>` : ''}
                                        </div>
                                        ${afterTaxStr ? html`<div style="font-size:9px; color:#f97316; margin-bottom:2px;">${zh ? '税后：' : 'After-tax: '}${afterTaxStr}</div>` : ''}
                                        <div style="font-size:9px; color:#6b7280; line-height:1.3;">${a.detail}</div>
                                    </div>
                                `;
                            })}
                        </div>
                    ` : ''}

                    <!-- ═══ SECTION: STRATEGIC RECOMMENDATION ═══ -->
                    <${SectionHeader} id="recommendation" label=${t('Strategic Recommendation')} />
                    ${sections.recommendation ? html`
                        <div style="margin-bottom:12px;">
                            <${RecommendationBox} title=${compositeSignal.title} type=${compositeSignal.type}>
                                ${compositeSignal.body}
                                ${topPicks.overweight.length > 0 || topPicks.avoid.length > 0 ? html`
                                    <div style="margin-top:10px; display:grid; grid-template-columns:1fr 1fr; gap:6px;">
                                        ${topPicks.overweight.length > 0 ? html`
                                            <div>
                                                <div style="font-size:10px; font-weight:700; color:#4ade80; margin-bottom:3px; text-transform:uppercase;">${zh ? '🔺 超配推荐' : '🔺 OVERWEIGHT'}</div>
                                                ${topPicks.overweight.map(a => html`<div style="font-size:10px; color:#d1d5db; line-height:1.5;">• <strong>${a.label}</strong> — ${a.detail}</div>`)}
                                            </div>
                                        ` : ''}
                                        ${topPicks.avoid.length > 0 ? html`
                                            <div>
                                                <div style="font-size:10px; font-weight:700; color:#f87171; margin-bottom:3px; text-transform:uppercase;">${zh ? '🔻 回避/减仓' : '🔻 AVOID / REDUCE'}</div>
                                                ${topPicks.avoid.map(a => html`<div style="font-size:10px; color:#d1d5db; line-height:1.5;">• <strong>${a.label}</strong> — ${a.detail}</div>`)}
                                            </div>
                                        ` : ''}
                                    </div>
                                ` : ''}
                            </${RecommendationBox}>
                        </div>
                    ` : ''}

                    <!-- ═══ SECTION: ARBITRAGE PLAYBOOK ═══ -->
                    <${SectionHeader} id="playbook" label=${t('Arbitrage Playbook')} />
                    ${sections.playbook ? html`
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; font-size:11px; margin-bottom:14px;">
                            ${playbook.map(p => html`
                                <div style="border:1px solid ${p.border}; background:${p.bg}; border-radius:6px; padding:10px; ${p.active ? 'box-shadow: 0 0 12px rgba(255,255,255,0.05);' : ''}">
                                    <div style="font-weight:600; color:${p.titleColor}; margin-bottom:3px;">
                                        ${p.icon} ${p.title} ${p.active ? (zh ? '◀ 当前' : '◀ CURRENT') : ''}
                                    </div>
                                    <div style="color:${p.descColor}; line-height:1.4;">${p.desc}</div>
                                </div>
                            `)}
                        </div>
                        <!-- Carry Trade Monitor -->
                        ${carryTradeData.carry != null ? html`
                            <div style="margin-bottom:14px; padding:10px 12px; background:rgba(59,130,246,0.06); border:1px solid rgba(59,130,246,0.2); border-radius:6px;">
                                <div style="font-weight:600; font-size:12px; color:#60a5fa; margin-bottom:4px;">${zh ? '套息交易实时监控' : 'Carry Trade Live Monitor'}</div>
                                <div style="font-size:11px; color:#d1d5db; line-height:1.5;">
                                    ${(() => {
                                        const carryColor = carryTradeData.carry >= 0 ? '#4ade80' : '#f87171';
                                        if (zh) return html`10Y收益率 (${fmtPctAbs(longBondRate)}) − 融资成本 (${fmtPctAbs(effectivePrime)}) = <span style="color:${carryColor}; font-weight:700;">${fmtPct(carryTradeData.carry)}</span>`;
                                        return html`10Y Yield (${fmtPctAbs(longBondRate)}) − Funding Cost (${fmtPctAbs(effectivePrime)}) = <span style="color:${carryColor}; font-weight:700;">${fmtPct(carryTradeData.carry)}</span>`;
                                    })()}
                                    ${carryTradeData.carry > 0.5
                                        ? (zh ? ' — 正利差。以基准利率借款，以10年期利率放贷。加杠杆可放大收益。' : ' — Positive carry. Borrow at Prime, lend at 10Y. Leverage amplifies returns.')
                                        : (zh ? ' — 负利差或微薄利差。不建仓/清仓套息头寸。' : ' — Negative or thin carry. Do not enter / unwind carry positions.')
                                    }
                                </div>
                            </div>
                        ` : ''}
                    ` : ''}

                    <!-- ═══ SECTION: HISTORICAL DATA TABLE ═══ -->
                    <${SectionHeader} id="history" label=${`${t('Historical Data')} (${historyRows.length} ${zh ? '条记录' : 'records'})`} />
                    ${sections.history ? html`
                        <div style="margin-bottom:14px; overflow-x:auto;">
                            <table style="width:100%; font-size:10px; border-collapse:collapse; font-family:monospace;">
                                <thead>
                                    <tr style="color:#6b7280; text-align:right;">
                                        <th style="text-align:left; padding:3px 4px;">${zh ? '季度' : 'Qtr'}</th>
                                        <th style="padding:3px 4px;">10Y</th>
                                        <th style="padding:3px 4px;">2Y</th>
                                        <th style="padding:3px 4px;">${zh ? '利差' : 'Spread'}</th>
                                        <th style="padding:3px 4px;">GDP</th>
                                        <th style="padding:3px 4px;">${zh ? '基准' : 'Prime'}</th>
                                        <th style="padding:3px 4px;">${zh ? '套息' : 'Carry'}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${historyRows.map(r => html`
                                        <tr style="color:#9ca3af; text-align:right; border-bottom:1px solid rgba(255,255,255,0.04);">
                                            <td style="text-align:left; padding:3px 4px; color:#6b7280;">Q${r.q} ${r.y}</td>
                                            <td style="padding:3px 4px; color:#e5e7eb;">${r.lb != null ? fmtPctAbs(r.lb) : '-'}</td>
                                            <td style="padding:3px 4px; color:#e5e7eb;">${r.sb != null ? fmtPctAbs(r.sb) : '-'}</td>
                                            <td style="padding:3px 4px; color:${r.spread != null ? (r.spread >= 0 ? '#4ade80' : '#f87171') : '#6b7280'};">${r.spread != null ? fmtPct(r.spread) : '-'}</td>
                                            <td style="padding:3px 4px; color:#e5e7eb;">${r.gdp != null ? fmtPct(r.gdp) : '-'}</td>
                                            <td style="padding:3px 4px; color:#e5e7eb;">${r.pr != null ? fmtPctAbs(r.pr) : '-'}</td>
                                            <td style="padding:3px 4px; color:${r.carry != null ? (r.carry >= 0 ? '#4ade80' : '#f87171') : '#6b7280'};">${r.carry != null ? fmtPct(r.carry) : '-'}</td>
                                        </tr>
                                    `)}
                                    ${historyRows.length === 0 ? html`
                                        <tr><td colspan="7" style="text-align:center; padding:12px; color:#6b7280;">${zh ? '推进游戏以积累历史快照数据。每个季度自动记录。' : 'Advance the game to accumulate historical snapshots. Automatically recorded each quarter.'}</td></tr>
                                    ` : ''}
                                </tbody>
                            </table>
                        </div>
                    ` : ''}

                    <!-- ═══ METHODOLOGY NOTE ═══ -->
                    <div style="padding:8px 10px; background:rgba(255,255,255,0.02); border-radius:4px; font-size:10px; color:#6b7280; line-height:1.4;">
                        <strong>${t('Methodology:')}</strong> ${zh
                            ? '指标改编自桥水基金全天候框架、萨姆法则衰退检测及美债套利框架。收益率曲线使用游戏内长期(10年)/短期(2年)国债利率。增长-收益率差额通过比较GDP增长与无风险债券收益率来近似股权风险溢价。套息交易空间 = 10Y − 基准利率。周期四阶段模型基于利率方向 + 曲线方向 + GDP趋势。历史数据每季度自动记录到存档中。此为决策辅助工具，非投资建议。'
                            : 'Indicators adapted from Bridgewater All-Weather framework, Sahm Rule recession detection, and Treasury arbitrage methodology. Yield curve uses in-game long (10Y) / short (2Y) bond rates. Carry trade space = 10Y − Prime Rate (SOFR proxy). 4-stage cycle model based on rate direction + curve direction + GDP trend. Historical snapshots auto-saved to your game file each quarter. This is a decision-support tool, not financial advice.'}
                    </div>

                </div>
            </div>
        <//>
    `;
};

export default MacroIndicatorPanel;
