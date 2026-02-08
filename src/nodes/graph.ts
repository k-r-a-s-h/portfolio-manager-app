import { StateGraph, END, START } from "@langchain/langgraph";
import { GraphState } from "./state.js";
import { agentNode } from "./agent.js"; // Import node from separate file

// Define the state structure with reducers and flow
const workflow = new StateGraph(GraphState)
    .addNode("agent", agentNode)
    .addEdge(START, "agent")
    .addEdge("agent", END);

// Compile the graph
export const graph = workflow.compile();
