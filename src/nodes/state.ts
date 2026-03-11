import { BaseMessage } from "@langchain/core/messages";
import { Annotation } from "@langchain/langgraph";
import type { PortfolioData } from "../types/portfolio.js";

export const GraphState = Annotation.Root({
    messages: Annotation<BaseMessage[]>({
        reducer: (x, y) => x.concat(y),
        default: () => [],
    }),
    // Portfolio data loaded from the session store before the agent runs.
    // The agent node uses this to answer questions about the user's holdings.
    portfolioData: Annotation<PortfolioData | undefined>({
        reducer: (_prev, next) => next,
        default: () => undefined,
    }),
    // The sessionId links this chat turn to an ingested portfolio.
    sessionId: Annotation<string | undefined>({
        reducer: (_prev, next) => next,
        default: () => undefined,
    }),
});

export type GraphState = typeof GraphState.State;
