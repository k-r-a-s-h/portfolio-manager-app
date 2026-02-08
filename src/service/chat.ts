import { HumanMessage } from "langchain";
import { graph } from "../nodes/graph.js";

export const processChatMessage = async (message: string): Promise<any> => {
    // TODO: Integrate with LangGraph/LangChain here
    const result = await graph.invoke({
        messages: [new HumanMessage({ content: message })],
    });
    return result;
};
