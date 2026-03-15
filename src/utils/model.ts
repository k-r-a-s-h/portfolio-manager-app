/**
 * Provider-agnostic LLM factory.
 *
 * Configuration (via environment variables):
 *   LLM_PROVIDER  – "openai" (default) | "anthropic"
 *   LLM_MODEL     – optional model name override
 *   OPENAI_API_KEY    – required when LLM_PROVIDER=openai
 *   ANTHROPIC_API_KEY – required when LLM_PROVIDER=anthropic
 *
 * The rest of the codebase imports BaseChatModel from @langchain/core and
 * calls getModel() here — no provider-specific code leaks out.
 *
 * To add a new provider: add a case below and install its @langchain/* package.
 */

import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import Logger from './logger.js';

let _model: BaseChatModel | null = null;

export async function getModel(): Promise<BaseChatModel> {
    if (_model) return _model;

    const provider = (process.env.LLM_PROVIDER ?? 'openai').toLowerCase();
    const modelName = process.env.LLM_MODEL;

    Logger.info(`[Model] Initialising provider="${provider}" model="${modelName ?? 'default'}"`);

    switch (provider) {
        case 'openai': {
            const { ChatOpenAI } = await import('@langchain/openai');
            _model = new ChatOpenAI({
                modelName: modelName ?? 'gpt-4o-mini',
            });
            break;
        }
        case 'anthropic': {
            const { ChatAnthropic } = await import('@langchain/anthropic');
            _model = new ChatAnthropic({
                modelName: modelName ?? 'claude-3-5-haiku-latest',
            });
            break;
        }
        default:
            throw new Error(
                `Unknown LLM_PROVIDER="${provider}". ` +
                `Supported values: "openai", "anthropic". ` +
                `Set the matching API key env var (OPENAI_API_KEY / ANTHROPIC_API_KEY).`,
            );
    }

    return _model;
}
