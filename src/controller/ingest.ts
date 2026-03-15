import type { Request, Response } from 'express';
import { ingestPortfolioFile } from '../service/ingest.js';
import Logger from '../utils/logger.js';

/**
 * POST /ingest
 *
 * Multipart form fields:
 *   file        – the Excel (.xlsx / .xls) file  [required]
 *   brokerHint  – broker name to guide detection  [optional]
 *
 * Response 200:
 *   {
 *     sessionId:   string,          // use in subsequent /chat calls
 *     broker:      string | null,
 *     strategy:    "registry" | "fuzzy" | "llm" | "failed",
 *     holdingsCount: number,
 *     totalValue:  number | null,
 *     rawHeaders:  string[]
 *   }
 */
export const ingestController = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.file) {
            res.status(400).json({ error: 'No file uploaded. Send a multipart/form-data request with field "file".' });
            return;
        }

        const brokerHint = typeof req.body?.brokerHint === 'string'
            ? req.body.brokerHint.trim() || undefined
            : undefined;

        const { sessionId, portfolio } = await ingestPortfolioFile(req.file.path, brokerHint);

        res.status(200).json({
            sessionId,
            broker: portfolio.broker ?? null,
            strategy: portfolio.mappingStrategy,
            holdingsCount: portfolio.holdings.length,
            totalValue: portfolio.totalValue ?? null,
            rawHeaders: portfolio.rawHeaders,
        });
    } catch (err) {
        Logger.error('[IngestController] Error:', err);
        const message = err instanceof Error ? err.message : 'Internal server error';
        res.status(500).json({ error: message });
    }
};
