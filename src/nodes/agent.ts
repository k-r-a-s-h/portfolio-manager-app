import { SystemMessage } from '@langchain/core/messages';
import type { GraphState } from './state.js';
import type { Holding, PortfolioData } from '../types/portfolio.js';
import { getModel } from '../utils/model.js';
import Logger from '../utils/logger.js';

// ---------------------------------------------------------------------------
// Portfolio → system prompt
// ---------------------------------------------------------------------------

function formatHolding(h: Holding): string {
    const parts = [`${h.symbol}`];
    if (h.name) parts.push(`(${h.name})`);
    parts.push(`qty=${h.quantity}`);
    if (h.avgCostPrice !== undefined) parts.push(`avgCost=${h.avgCostPrice}`);
    if (h.currentPrice !== undefined) parts.push(`price=${h.currentPrice}`);
    if (h.currentValue !== undefined) parts.push(`value=${h.currentValue}`);
    if (h.pnl !== undefined) parts.push(`pnl=${h.pnl}`);
    if (h.pnlPercent !== undefined) parts.push(`pnl%=${h.pnlPercent}`);
    if (h.sector) parts.push(`sector=${h.sector}`);
    return parts.join(', ');
}

function buildSystemPrompt(portfolio: PortfolioData | undefined): string {
    if (!portfolio) {
        return (
            'You are a portfolio management assistant. ' +
            'No portfolio has been uploaded yet. ' +
            'Ask the user to upload their brokerage statement via POST /ingest before asking portfolio questions.'
        );
    }

    const currency = portfolio.currency ?? '';
    const totalValue = portfolio.totalValue !== undefined
        ? `${currency}${portfolio.totalValue.toLocaleString()}`
        : 'unknown';

    const holdingLines = portfolio.holdings.map(formatHolding).join('\n  ');

    return [
        'You are a portfolio management assistant.',
        `The user's portfolio (source: ${portfolio.broker ?? 'uploaded file'}):`,
        `  Total holdings : ${portfolio.holdings.length}`,
        `  Total value    : ${totalValue}`,
        '',
        'Holdings:',
        `  ${holdingLines}`,
        '',
        'Answer questions about this portfolio clearly and concisely.',
        'Use the data above as the source of truth.',
        'If the user asks something outside the portfolio data, say so honestly.',
    ].join('\n');
}

// ---------------------------------------------------------------------------
// Agent node
// ---------------------------------------------------------------------------

export const agentNode = async (state: GraphState): Promise<Partial<GraphState>> => {
    const { messages, portfolioData } = state;

    try {
        const model = await getModel();
        const systemMessage = new SystemMessage(buildSystemPrompt(portfolioData));

        Logger.info(`[AgentNode] Invoking LLM with ${messages.length} message(s) in history.`);

        const response = await model.invoke([systemMessage, ...messages]);

        return { messages: [response] };
    } catch (err) {
        Logger.error('[AgentNode] LLM call failed:', err);
        throw err;
    }
};
