/**
 * Hybrid format detector: tries strategies in order until one succeeds.
 *
 *  Strategy A – Broker Registry   : exact match on known broker column fingerprints
 *  Strategy B – Fuzzy Matching    : synonym-based header matching with confidence scoring
 *  Strategy C – LLM Mapping       : send headers + sample rows to an LLM for mapping
 *                                   (stub only – wire up an LLM client when ready)
 */

import type { BrokerSchema, ColumnMapping, StandardField } from '../types/portfolio.js';
import Logger from '../utils/logger.js';

// ---------------------------------------------------------------------------
// Strategy A – Broker Registry
// ---------------------------------------------------------------------------

/**
 * Each entry declares:
 *  - fingerprint: normalised substrings ALL of which must appear in the header set
 *  - mapping: raw header name → StandardField
 *
 * Add new brokers here as you encounter them.
 */
const BROKER_REGISTRY: BrokerSchema[] = [
    {
        // Zerodha Console Holdings export
        name: 'Zerodha',
        fingerprint: ['instrumenttype', 'avgcost', 'curval'],
        mapping: {
            symbol: 'Instrument',
            assetClass: 'Instrument Type',
            quantity: 'Qty.',
            avgCostPrice: 'Avg. cost',
            currentPrice: 'LTP',
            currentValue: 'Cur. val',
            pnl: 'P&L',
            pnlPercent: 'Net chg.',
        },
    },
    {
        // Groww Holdings export
        name: 'Groww',
        fingerprint: ['avgbuyprice', 'currentvalue'],
        mapping: {
            symbol: 'Symbol',
            name: 'Company',
            quantity: 'Quantity',
            avgCostPrice: 'Avg Buy Price',
            currentPrice: 'Current Price',
            currentValue: 'Current Value',
            pnl: 'P&L',
            pnlPercent: 'Day Change %',
        },
    },
    {
        // Angel One Holdings export
        name: 'Angel One',
        fingerprint: ['tradingsymbol', 'avgnetprice'],
        mapping: {
            symbol: 'Trading Symbol',
            name: 'Company Name',
            isin: 'ISIN',
            quantity: 'Qty',
            avgCostPrice: 'Avg Net Price',
            currentPrice: 'Market Price',
            currentValue: 'Market Value',
            pnl: 'Unrealised P&L',
            pnlPercent: 'Unrealised P&L(%)',
        },
    },
    {
        // Fidelity Positions export (US)
        name: 'Fidelity',
        fingerprint: ['costbasisshare', 'percentofaccount'],
        mapping: {
            symbol: 'Symbol',
            name: 'Description',
            quantity: 'Quantity',
            avgCostPrice: 'Cost Basis/Share',
            currentPrice: 'Last Price',
            currentValue: 'Current Value',
            pnl: 'Gain/Loss Dollar',
            pnlPercent: 'Gain/Loss Percent',
        },
    },
    {
        // Charles Schwab Positions export (US)
        name: 'Schwab',
        fingerprint: ['averagecost', 'marketvalue', 'daychange%'],
        mapping: {
            symbol: 'Symbol',
            name: 'Description',
            quantity: 'Quantity',
            avgCostPrice: 'Average Cost',
            currentPrice: 'Price',
            currentValue: 'Market Value',
            pnl: 'Unrealized P/L',
            pnlPercent: 'Unrealized P/L %',
        },
    },
];

// ---------------------------------------------------------------------------
// Strategy B – Fuzzy / Synonym matching
// ---------------------------------------------------------------------------

/** Synonyms used to recognise each standard field from arbitrary header names. */
const FIELD_SYNONYMS: Record<StandardField, string[]> = {
    symbol: ['symbol', 'ticker', 'scrip', 'stock', 'security', 'instrument',
        'tradingsymbol', 'stockcode', 'scripcode', 'nse', 'bse'],
    name: ['name', 'companyname', 'stockname', 'securityname',
        'description', 'instrumentname', 'company'],
    isin: ['isin'],
    quantity: ['quantity', 'qty', 'shares', 'units', 'holding',
        'balance', 'sharesowned', 'noofshares'],
    avgCostPrice: ['avgcost', 'averagecost', 'costprice', 'purchaseprice',
        'buyprice', 'avgbuyprice', 'averagebuyprice', 'costpershare',
        'costbasisshare', 'avgnetprice', 'avgprice'],
    currentPrice: ['currentprice', 'marketprice', 'ltp', 'lasttradedprice',
        'price', 'closeprice', 'nav', 'lastprice', 'mktprice'],
    currentValue: ['currentvalue', 'marketvalue', 'curval', 'value',
        'presentvalue', 'investmentvalue', 'mktvalue'],
    pnl: ['pnl', 'profitloss', 'unrealizedpnl', 'gainloss',
        'unrealizedgainloss', 'pl', 'profit', 'return',
        'unrealisedpl', 'unrealisedpnl'],
    pnlPercent: ['pnlpct', 'pnlpercentage', 'returnpct', 'gainlosspct',
        'changepct', 'returns%', 'netchg', 'unrealizedplpct',
        'unrealisedpl%', 'unrealizedpl%', 'daychange%'],
    sector: ['sector', 'industry', 'category', 'sectorname'],
    assetClass: ['assetclass', 'assettype', 'instrumenttype', 'type',
        'producttype', 'segment'],
};

/** Confidence threshold below which we do NOT accept a fuzzy match. */
const MIN_CONFIDENCE = 0.6;

/** Strip everything except alphanumeric, lowercase. */
const normalise = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Score how well a raw header matches a set of synonyms.
 * Returns a value in [0, 1].
 */
function scoreSynonyms(rawHeader: string, synonyms: string[]): number {
    const h = normalise(rawHeader);
    for (const syn of synonyms) {
        if (h === syn) return 1.0;           // exact match
        if (h.includes(syn)) return 0.85;    // header contains synonym
        if (syn.includes(h)) return 0.75;    // synonym contains header
    }
    return 0;
}

/**
 * Try to map every header to a StandardField using synonym scoring.
 * Returns the mapping and an overall confidence (average of individual scores).
 */
function fuzzyMatch(headers: string[]): { mapping: ColumnMapping; confidence: number } {
    const mapping: ColumnMapping = {};
    const scores: number[] = [];

    const usedFields = new Set<StandardField>();

    for (const header of headers) {
        let bestField: StandardField | null = null;
        let bestScore = 0;

        for (const [field, synonyms] of Object.entries(FIELD_SYNONYMS) as [StandardField, string[]][]) {
            if (usedFields.has(field)) continue;
            const score = scoreSynonyms(header, synonyms);
            if (score > bestScore) {
                bestScore = score;
                bestField = field;
            }
        }

        if (bestField && bestScore >= MIN_CONFIDENCE) {
            mapping[bestField] = header;
            usedFields.add(bestField);
            scores.push(bestScore);
        }
    }

    const confidence = scores.length > 0
        ? scores.reduce((a, b) => a + b, 0) / scores.length
        : 0;

    return { mapping, confidence };
}

// ---------------------------------------------------------------------------
// Strategy C – LLM Mapping (stub)
// ---------------------------------------------------------------------------

/**
 * Asks an LLM to map raw Excel headers to StandardField keys.
 *
 * TODO: replace the stub body with a real LLM call once a model is configured.
 *
 * Example prompt to use:
 *   "Given these Excel headers and sample rows from a brokerage statement,
 *    return a JSON object mapping each header to one of these field names:
 *    symbol, name, isin, quantity, avgCostPrice, currentPrice, currentValue,
 *    pnl, pnlPercent, sector, assetClass.
 *    Only include headers you are confident about.
 *    Headers: {headers}
 *    Sample rows: {rows}"
 */
async function llmMap(
    headers: string[],
    sampleRows: Record<string, unknown>[],   // first 3 data rows
): Promise<ColumnMapping> {
    // Stub: log what would be sent and return empty mapping.
    Logger.warn('[LLM Mapper] LLM client not yet configured. Headers sent:', headers);
    Logger.warn('[LLM Mapper] Sample rows:', sampleRows.slice(0, 3));

    // TODO: uncomment and adapt once @langchain/openai or Claude is wired up:
    //
    // import { ChatOpenAI } from '@langchain/openai';
    // const model = new ChatOpenAI({ modelName: 'gpt-4o-mini' });
    // const prompt = buildMappingPrompt(headers, sampleRows);
    // const response = await model.invoke(prompt);
    // return JSON.parse(response.content as string) as ColumnMapping;

    return {};
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface DetectionResult {
    mapping: ColumnMapping;
    broker?: string;
    strategy: 'registry' | 'fuzzy' | 'llm' | 'failed';
    confidence?: number;
}

/**
 * Run the full A → B → C detection pipeline and return the best mapping found.
 *
 * @param headers     Raw header strings from the first row of the Excel sheet.
 * @param sampleRows  First few data rows (used only for Strategy C).
 * @param brokerHint  Optional broker name from the caller – checked against registry first.
 */
export async function detectColumnMapping(
    headers: string[],
    sampleRows: Record<string, unknown>[] = [],
    brokerHint?: string,
): Promise<DetectionResult> {

    const normHeaders = headers.map(normalise);

    // ── Strategy A: Broker Registry ─────────────────────────────────────────
    const candidates = brokerHint
        ? BROKER_REGISTRY.filter(b => b.name.toLowerCase() === brokerHint.toLowerCase())
        : BROKER_REGISTRY;

    for (const schema of candidates) {
        const matched = schema.fingerprint.every(fp => normHeaders.some(h => h.includes(fp)));
        if (matched) {
            Logger.info(`[Detector] Strategy A matched broker: ${schema.name}`);
            return { mapping: schema.mapping, broker: schema.name, strategy: 'registry' };
        }
    }
    Logger.info('[Detector] Strategy A: no registry match.');

    // ── Strategy B: Fuzzy Header Matching ───────────────────────────────────
    const { mapping: fuzzyMapping, confidence } = fuzzyMatch(headers);
    // Accept fuzzy result if we mapped at least symbol + quantity with reasonable confidence
    if (fuzzyMapping.symbol && fuzzyMapping.quantity && confidence >= MIN_CONFIDENCE) {
        Logger.info(`[Detector] Strategy B matched with confidence ${confidence.toFixed(2)}`);
        return { mapping: fuzzyMapping, strategy: 'fuzzy', confidence };
    }
    Logger.info(`[Detector] Strategy B: low confidence (${confidence.toFixed(2)}), trying LLM.`);

    // ── Strategy C: LLM Mapping ──────────────────────────────────────────────
    const llmMapping = await llmMap(headers, sampleRows);
    if (llmMapping.symbol && llmMapping.quantity) {
        Logger.info('[Detector] Strategy C (LLM) produced a mapping.');
        return { mapping: llmMapping, strategy: 'llm' };
    }

    // ── All strategies failed ────────────────────────────────────────────────
    Logger.warn('[Detector] All strategies failed. Returning partial fuzzy mapping.');
    return { mapping: fuzzyMapping, strategy: 'failed', confidence };
}
