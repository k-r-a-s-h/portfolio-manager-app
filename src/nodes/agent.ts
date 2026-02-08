
import type { GraphState } from "./state.js";
import { HumanMessage, AIMessage } from "@langchain/core/messages";

// Simple node that just echoes back a message for now
// In a real app, this would use a LangChain runnable or model
export const agentNode = async (state: GraphState): Promise<Partial<GraphState>> => {
    const { messages } = state;
    const lastMessage = messages[messages.length - 1];

    // Simulate processing
    console.log("Processing message:", lastMessage?.content || "No content");

    // Return ONLY the new messages to append, because our graph reducer handles the concatenation
    return {
        messages: [
            new AIMessage({ content: "This is a response from the agent node." })
        ]
    };
};
