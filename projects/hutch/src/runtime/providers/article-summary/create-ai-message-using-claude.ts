/* c8 ignore start */

import Anthropic from "@anthropic-ai/sdk";
import { HutchLogger } from "@packages/hutch-logger"
import type { CreateAiMessageParams } from "./article-summary.types"

import { requireEnv } from "../../require-env";

/**
 * 1. Mandatory import of the Anthropic API key at runtime
 *    This ensures it only fails if in an environment where this code
 *    is executed (like prod)
 */
export const createAIMessageUsingClaude = () => (params: CreateAiMessageParams) => {
  const anthropicApiKey = requireEnv("ANTHROPIC_API_KEY"); /* 1 */
  const anthropicClient = new Anthropic({ apiKey: anthropicApiKey });
  return anthropicClient.messages.create(params)
}

export const createAIMessageUsingLoggerOutput = ({ logger }: { logger: HutchLogger }) => (params: CreateAiMessageParams) => {
  // Log the call without full content to avoid flooding CI logs (Wikipedia articles are 100KB+)
  logger.info(`[AI Summary Stub] model=${params.model} content_length=${params.messages[0]?.content?.length ?? null}`);
  return Promise.resolve({
    content: [{
      type: "text",
      text: JSON.stringify({ summary: `[AI Summary Stub] for model ${params.model}` })
    }],
    usage: { input_tokens: 0, output_tokens: 0 }
  })
}

/* c8 ignore stop */