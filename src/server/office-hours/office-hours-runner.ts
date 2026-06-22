import type { Agent } from "@prisma/client";
import { modelRouter } from "@/server/ai/providers/model-router";
import { getMockProvider } from "@/server/ai/providers/provider-registry";
import { logAICall, logAIProviderError, logAIWarning } from "@/server/ai/providers/ai-observability";
import { AIProviderError } from "@/server/ai/providers/ai-provider-error";
import { generateMockOfficeHoursResponse } from "@/server/agents/mock-agent-responses";
import type { MockOfficeHoursMetadata, OfficeHoursRunResult } from "./office-hours-types";

export class OfficeHoursRunner {
  async run(params: {
    agent: Agent;
    systemPrompt: string;
    userPrompt: string;
    founderMessage: string;
  }): Promise<OfficeHoursRunResult> {
    const resolved = modelRouter.resolveForAgent(params.agent);
    const mockMeta: MockOfficeHoursMetadata = {
      agent: params.agent,
      founderMessage: params.founderMessage,
    };

    const callProvider = async (provider = resolved.provider, fallbackUsed = resolved.fallbackUsed) => {
      const response = await provider.generate({
        systemPrompt: params.systemPrompt,
        userPrompt: params.userPrompt,
        responseFormat: "text",
        model: resolved.model,
        temperature: 0.7,
        maxTokens: 800,
        metadata:
          provider.name === "mock"
            ? (mockMeta as unknown as Record<string, unknown>)
            : undefined,
      });
      return { response, fallbackUsed };
    };

    try {
      const { response, fallbackUsed } = await callProvider();
      logAICall({
        provider: resolved.providerName,
        model: response.model ?? resolved.model,
        agentRole: params.agent.role,
        agentName: params.agent.name,
        round: 0,
        roundType: "OFFICE_HOURS",
        fallbackUsed,
        usage: response.usage,
      });

      return {
        content: response.content.trim(),
        provider: response.provider ?? resolved.providerName,
        model: response.model ?? resolved.model,
        tokenInput: response.usage?.inputTokens,
        tokenOutput: response.usage?.outputTokens,
        tokenTotal: response.usage?.totalTokens,
        fallbackUsed,
      };
    } catch (err) {
      if (resolved.providerName !== "mock") {
        if (err instanceof AIProviderError) {
          logAIProviderError({
            provider: resolved.providerName,
            model: resolved.model,
            errorType: err.type,
            retryable: err.retryable,
          });
        }
        logAIWarning(`Office Hours fallback to mock for ${params.agent.name}`);
        const mock = getMockProvider();
        const { response } = await callProvider(mock, true);
        return {
          content: response.content.trim(),
          provider: "mock",
          model: "mock-v1",
          fallbackUsed: true,
        };
      }
      throw err;
    }
  }
}

export const officeHoursRunner = new OfficeHoursRunner();
