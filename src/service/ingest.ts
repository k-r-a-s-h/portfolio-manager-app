import { ingestGraph } from '../nodes/ingestGraph.js';
import { sessionStore } from '../store/session.js';
import type { PortfolioData } from '../types/portfolio.js';
import Logger from '../utils/logger.js';

export interface IngestResult {
    sessionId: string;
    portfolio: PortfolioData;
}

/**
 * Run the ingest LangGraph workflow for the uploaded file, then persist the
 * resulting PortfolioData in the session store.
 *
 * @param filePath   Absolute path to the uploaded Excel file.
 * @param brokerHint Optional broker name that improves format detection.
 */
export const ingestPortfolioFile = async (
    filePath: string,
    brokerHint?: string,
): Promise<IngestResult> => {
    const result = await ingestGraph.invoke({ filePath, brokerHint });

    if (result.error || !result.portfolioData) {
        throw new Error(result.error ?? 'Ingest graph returned no portfolio data.');
    }

    const portfolio: PortfolioData = result.portfolioData;
    const sessionId = sessionStore.create(portfolio);

    Logger.info(
        `[IngestService] Session created: ${sessionId} | ` +
        `${portfolio.holdings.length} holdings | strategy: ${portfolio.mappingStrategy}`,
    );

    return { sessionId, portfolio };
};
