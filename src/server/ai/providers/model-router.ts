import type { Agent } from "@prisma/client";
import type { AIProvider, AIProviderMode, AIProviderName } from "./ai-provider";
import { logAIWarning } from "./ai-observability";
import { getMockProvider, getProvider } from "./provider-registry";

export type ResolvedProvider = {
  provider: AIProvider;
  providerName: AIProviderName;
  model: string;
  fallbackUsed: boolean;
  fallbackReason?: string;
};

export function getAIProviderMode(): AIProviderMode {
  const mode = process.env.AI_PROVIDER_MODE ?? "mock";
  if (mode === "openai" || mode === "hybrid" || mode === "mock") {
    return mode;
  }
  logAIWarning(`Unknown AI_PROVIDER_MODE "${mode}", defaulting to mock`);
  return "mock";
}

/** Agents seeded with mock-v1 must not pass that name to the OpenAI API. */
export function resolveOpenAIModel(agent: Agent, defaultModel: string): string {
  const isMockModel =
    !agent.modelName ||
    agent.modelName === "mock-v1" ||
    agent.modelName.startsWith("mock");

  if (!isMockModel && agent.modelName) {
    return agent.modelName;
  }

  return defaultModel;
}

export class ModelRouter {
  resolveForAgent(agent: Agent): ResolvedProvider {
    const mode = getAIProviderMode();
    const mock = getMockProvider();
    const defaultModel = process.env.OPENAI_DEFAULT_MODEL ?? "gpt-4o";

    if (mode === "mock") {
      return {
        provider: mock,
        providerName: "mock",
        model: agent.modelName || "mock-v1",
        fallbackUsed: false,
      };
    }

    const openai = getProvider("openai");
    const openaiAvailable = openai?.isAvailable() ?? false;

    if (mode === "openai") {
      if (!openaiAvailable || !openai) {
        logAIWarning("OPENAI_API_KEY missing — falling back to mock provider");
        return {
          provider: mock,
          providerName: "mock",
          model: "mock-v1",
          fallbackUsed: true,
          fallbackReason: "missing_openai_key",
        };
      }
      return {
        provider: openai,
        providerName: "openai",
        model: resolveOpenAIModel(agent, defaultModel),
        fallbackUsed: false,
      };
    }

    // hybrid: per-agent provider preference
    const agentWantsOpenAI =
      agent.modelProvider === "openai" || agent.modelProvider === "openai-provider";

    if (agentWantsOpenAI && openaiAvailable && openai) {
      return {
        provider: openai,
        providerName: "openai",
        model: resolveOpenAIModel(agent, defaultModel),
        fallbackUsed: false,
      };
    }

    if (agentWantsOpenAI && !openaiAvailable) {
      logAIWarning(`Agent ${agent.name} prefers openai but key missing — mock fallback`);
    }

    return {
      provider: mock,
      providerName: "mock",
      model: "mock-v1",
      fallbackUsed: agentWantsOpenAI,
      fallbackReason: agentWantsOpenAI ? "openai_unavailable" : undefined,
    };
  }
}

export const modelRouter = new ModelRouter();
