// Standard fields we normalise every broker's Excel into
export type StandardField =
    | 'symbol'
    | 'name'
    | 'isin'
    | 'quantity'
    | 'avgCostPrice'
    | 'currentPrice'
    | 'currentValue'
    | 'pnl'
    | 'pnlPercent'
    | 'sector'
    | 'assetClass';

// Maps a StandardField → the raw Excel header name for a given broker
export type ColumnMapping = Partial<Record<StandardField, string>>;

// Known broker schema: fingerprint columns uniquely identify the broker
export interface BrokerSchema {
    name: string;
    fingerprint: string[]; // normalised substrings that identify this broker
    mapping: ColumnMapping;
}

// One row of normalised portfolio data
export interface Holding {
    symbol: string;
    name?: string;
    isin?: string;
    quantity: number;
    avgCostPrice?: number;
    currentPrice?: number;
    currentValue?: number;
    pnl?: number;
    pnlPercent?: number;
    sector?: string;
    assetClass?: string;
}

// The full normalised portfolio extracted from an Excel file
export interface PortfolioData {
    holdings: Holding[];
    totalValue?: number;
    currency?: string;
    asOf?: Date;
    broker?: string;
    rawHeaders: string[];
    // Which detection strategy succeeded
    mappingStrategy: 'registry' | 'fuzzy' | 'llm' | 'failed';
}
