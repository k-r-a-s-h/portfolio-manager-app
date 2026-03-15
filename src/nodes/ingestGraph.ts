import { StateGraph, START, END } from '@langchain/langgraph';
import { IngestState } from './ingestState.js';
import { ingestNode } from './ingestNode.js';

const workflow = new StateGraph(IngestState)
    .addNode('ingest', ingestNode)
    .addEdge(START, 'ingest')
    .addEdge('ingest', END);

export const ingestGraph = workflow.compile();
