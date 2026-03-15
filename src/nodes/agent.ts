
import { initChatModel } from "langchain/chat_models/universal";
import { SystemMessage } from "@langchain/core/messages";
import type { GraphState } from "./state.js";


function buildSystemPrompt(state: GraphState): string {
    const { portfolioData } = state;
    const base =
        "You are a knowledgeable, concise portfolio management assistant. " +
        "Answer the user's questions about their investment portfolio accurately. " +
        "If you don't have enough information, say so clearly.";

    if (!portfolioData) return base;

    const { holdings, totalValue, currency, broker, mappingStrategy } = portfolioData;

    const holdingLines = holdings.map((h) => {
        const parts: string[] = [`${h.symbol} (qty: ${h.quantity})`];
        if (h.name) parts.push(`name: ${h.name}`);
        if (h.currentValue !== undefined) parts.push(`value: ${h.currentValue}`);
        if (h.pnl !== undefined) parts.push(`P&L: ${h.pnl}`);
        if (h.pnlPercent !== undefined) parts.push(`P&L%: ${h.pnlPercent}`);
        if (h.sector) parts.push(`sector: ${h.sector}`);
        if (h.assetClass) parts.push(`class: ${h.assetClass}`);
        return `  - ${parts.join(", ")}`;
    });

    const meta: string[] = [];
    if (broker) meta.push(`Broker: ${broker}`);
    if (currency) meta.push(`Currency: ${currency}`);
    if (totalValue !== undefined) meta.push(`Total value: ${totalValue}`);
    meta.push(`Detection strategy: ${mappingStrategy}`);

    return (
        `${base}\n\n` +
        `The user has loaded a portfolio with ${holdings.length} holding(s).\n` +
        (meta.length > 0 ? `${meta.join(" | ")}\n` : "") +
        `Holdings:\n${holdingLines.join("\n")}`
    );
}

export const agentNode = async (state: GraphState): Promise<Partial<GraphState>> => {
    const { messages } = state;
    const modelString = process.env["LLM_MODEL"] ?? "anthropic/claude-3-5-sonnet-20241022";
    const model = await initChatModel(modelString);
    const systemMessage = new SystemMessage({ content: buildSystemPrompt(state) });
    const response = await model.invoke([systemMessage, ...messages]);
    return { messages: [response] };
};
