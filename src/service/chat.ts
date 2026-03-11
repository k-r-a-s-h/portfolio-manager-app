import { HumanMessage } from "langchain";
import { graph } from "../nodes/graph.js";
import { GraphState } from "../nodes/state.js";
import { sessionStore } from "../store/session.js";

export const processChatMessage = async (message: string, sessionId?: string): Promise<GraphState> => {
    // Load portfolio data from session if a sessionId was provided
    const portfolioData = sessionId ? sessionStore.get(sessionId) : undefined;

    const result = await graph.invoke({
        messages: [new HumanMessage({ content: message })],
        portfolioData,
        sessionId,
    });
    return result;
};
