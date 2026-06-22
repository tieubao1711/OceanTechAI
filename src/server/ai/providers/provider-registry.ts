import type { AIProvider, AIProviderName } from "./ai-provider";
import { mockProvider } from "./mock-provider";
import { createOpenAIProvider } from "./openai-provider";

const registry = new Map<AIProviderName, AIProvider>();

export function registerProvider(provider: AIProvider): void {
  registry.set(provider.name, provider);
}

export function getProvider(name: AIProviderName): AIProvider | undefined {
  return registry.get(name);
}

export function getMockProvider(): AIProvider {
  return registry.get("mock") ?? mockProvider;
}

export function initializeProviders(): void {
  registerProvider(mockProvider);
  registerProvider(createOpenAIProvider());
}

// Eager init for server modules
initializeProviders();
