export type AIProviderName = "mock" | "openai" | "anthropic" | "google";

export type AIProviderMode = "mock" | "openai" | "hybrid";

export type AIProviderRequest = {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: "json" | "text";
  model?: string;
  metadata?: Record<string, unknown>;
};

export type AIProviderResponse = {
  content: string;
  raw?: unknown;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
  model?: string;
  provider?: AIProviderName;
};

export interface AIProvider {
  readonly name: AIProviderName;
  isAvailable(): boolean;
  generate(request: AIProviderRequest): Promise<AIProviderResponse>;
}
