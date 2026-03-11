import { Annotation } from '@langchain/langgraph';
import type { PortfolioData } from '../types/portfolio.js';

/**
 * State for the ingest graph.
 *
 * filePath       – absolute path to the uploaded Excel file
 * brokerHint     – optional broker name provided by the caller (improves detection)
 * portfolioData  – populated by the ingest node after parsing
 * error          – set if parsing/detection fails
 */
export const IngestState = Annotation.Root({
    filePath: Annotation<string>({
        reducer: (_prev, next) => next,
        default: () => '',
    }),
    brokerHint: Annotation<string | undefined>({
        reducer: (_prev, next) => next,
        default: () => undefined,
    }),
    portfolioData: Annotation<PortfolioData | undefined>({
        reducer: (_prev, next) => next,
        default: () => undefined,
    }),
    error: Annotation<string | undefined>({
        reducer: (_prev, next) => next,
        default: () => undefined,
    }),
});

export type IngestState = typeof IngestState.State;
