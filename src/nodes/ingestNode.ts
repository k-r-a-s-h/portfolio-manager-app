import * as XLSX from 'xlsx';
import type { IngestState } from './ingestState.js';
import type { Holding, PortfolioData, ColumnMapping } from '../types/portfolio.js';
import { detectColumnMapping } from '../formats/detector.js';
import Logger from '../utils/logger.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Safely parse a cell value as a number; returns undefined if not numeric. */
function toNumber(val: unknown): number | undefined {
    if (val === null || val === undefined || val === '') return undefined;
    const n = Number(val);
    return isNaN(n) ? undefined : n;
}

/** Extract a value from a raw row using the mapped header name. */
function pick(row: Record<string, unknown>, header: string | undefined): unknown {
    if (!header) return undefined;
    return row[header];
}

/**
 * Build a Holding from one raw row + the detected mapping.
 * Returns null if required fields (symbol or quantity) are missing.
 *
 * Uses conditional spreading so that undefined optional fields are never
 * set explicitly (required by exactOptionalPropertyTypes).
 */
function buildHolding(row: Record<string, unknown>, mapping: ColumnMapping): Holding | null {
    const symbol = String(pick(row, mapping.symbol) ?? '').trim();
    const quantity = toNumber(pick(row, mapping.quantity));

    if (!symbol || symbol.toLowerCase() === 'symbol') return null;
    if (quantity === undefined || quantity === 0) return null;

    const name = mapping.name ? String(pick(row, mapping.name) ?? '').trim() : '';
    const isin = mapping.isin ? String(pick(row, mapping.isin) ?? '').trim() : '';
    const sector = mapping.sector ? String(pick(row, mapping.sector) ?? '').trim() : '';
    const assetClass = mapping.assetClass ? String(pick(row, mapping.assetClass) ?? '').trim() : '';

    const avgCostPrice = toNumber(pick(row, mapping.avgCostPrice));
    const currentPrice = toNumber(pick(row, mapping.currentPrice));
    const currentValue = toNumber(pick(row, mapping.currentValue));
    const pnl = toNumber(pick(row, mapping.pnl));
    const pnlPercent = toNumber(pick(row, mapping.pnlPercent));

    // Build base required holding then spread optional fields only when defined
    const holding: Holding = {
        symbol,
        quantity,
        ...(name ? { name } : {}),
        ...(isin ? { isin } : {}),
        ...(sector ? { sector } : {}),
        ...(assetClass ? { assetClass } : {}),
        ...(avgCostPrice !== undefined ? { avgCostPrice } : {}),
        ...(currentPrice !== undefined ? { currentPrice } : {}),
        ...(currentValue !== undefined ? { currentValue } : {}),
        ...(pnl !== undefined ? { pnl } : {}),
        ...(pnlPercent !== undefined ? { pnlPercent } : {}),
    };

    return holding;
}

/** Sum currentValue across holdings to compute totalValue. */
function computeTotalValue(holdings: Holding[]): number | undefined {
    const values = holdings.map(h => h.currentValue).filter((v): v is number => v !== undefined);
    return values.length > 0 ? values.reduce((a, b) => a + b, 0) : undefined;
}

// ---------------------------------------------------------------------------
// Ingest Node
// ---------------------------------------------------------------------------

/**
 * LangGraph node that:
 *  1. Reads the Excel file from state.filePath
 *  2. Extracts headers and row data from the first sheet
 *  3. Runs the hybrid format detector (registry → fuzzy → LLM)
 *  4. Normalises rows into Holding objects
 *  5. Returns updated state with portfolioData (or an error message)
 */
export const ingestNode = async (state: IngestState): Promise<Partial<IngestState>> => {
    const { filePath, brokerHint } = state;

    if (!filePath) {
        return { error: 'No file path provided in state.' };
    }

    try {
        // ── 1. Parse the Excel file ──────────────────────────────────────────
        const workbook = XLSX.readFile(filePath, { cellDates: true });
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) {
            return { error: 'Excel file has no sheets.' };
        }

        const sheet = workbook.Sheets[sheetName];
        if (!sheet) {
            return { error: `Sheet "${sheetName}" could not be read.` };
        }

        // Convert to array of plain objects; first row becomes the keys
        const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
            defval: '',
            raw: false,
        });

        if (rawRows.length === 0) {
            return { error: 'Excel sheet is empty.' };
        }

        const firstRow = rawRows[0];
        if (!firstRow) {
            return { error: 'Could not read the first row of the Excel sheet.' };
        }

        const headers = Object.keys(firstRow);
        Logger.info(`[IngestNode] Parsed ${rawRows.length} rows with headers: ${headers.join(', ')}`);

        // ── 2. Detect column mapping ─────────────────────────────────────────
        const sampleRows = rawRows.slice(0, 3);
        const detection = await detectColumnMapping(headers, sampleRows, brokerHint);

        Logger.info(
            `[IngestNode] Detection strategy: ${detection.strategy}, ` +
            `broker: ${detection.broker ?? 'unknown'}`,
        );

        if (detection.strategy === 'failed' && !detection.mapping.symbol) {
            return {
                error:
                    `Could not map Excel columns to portfolio fields. ` +
                    `Headers found: ${headers.join(', ')}. ` +
                    `Try passing a 'brokerHint' or ensure columns have recognisable names.`,
            };
        }

        // ── 3. Build normalised holdings ─────────────────────────────────────
        const holdings: Holding[] = rawRows
            .map(row => buildHolding(row, detection.mapping))
            .filter((h): h is Holding => h !== null);

        if (holdings.length === 0) {
            return { error: 'No valid holdings found after parsing. Check the file format.' };
        }

        // ── 4. Assemble PortfolioData ────────────────────────────────────────
        const totalValue = computeTotalValue(holdings);

        const portfolioData: PortfolioData = {
            holdings,
            rawHeaders: headers,
            mappingStrategy: detection.strategy,
            ...(totalValue !== undefined ? { totalValue } : {}),
            ...(detection.broker ? { broker: detection.broker } : {}),
        };

        Logger.info(`[IngestNode] Successfully ingested ${holdings.length} holdings.`);
        return { portfolioData };

    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        Logger.error('[IngestNode] Error parsing Excel file:', err);
        return { error: `Failed to parse Excel file: ${message}` };
    }
};
