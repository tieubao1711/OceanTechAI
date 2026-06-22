import OpenAI from "openai";
import type { AIProvider, AIProviderRequest, AIProviderResponse } from "./ai-provider";
import {
  AIProviderError,
  AIProviderErrorType,
  createInvalidResponseError,
  mapProviderError,
} from "./ai-provider-error";
import { logAIProviderError } from "./ai-observability";
import {
  getProviderMaxRetries,
  getProviderTimeoutMs,
  withRetry,
} from "./retry-utils";

export class OpenAIProvider implements AIProvider {
  readonly name = "openai" as const;
  private client: OpenAI | null = null;

  constructor(private readonly defaultModel: string) {}

  isAvailable(): boolean {
    return !!process.env.OPENAI_API_KEY;
  }

  private getClient(): OpenAI {
    if (!this.client) {
      if (!process.env.OPENAI_API_KEY) {
        const err = new AIProviderError({
          type: AIProviderErrorType.AUTHENTICATION,
          message: "OPENAI_API_KEY is not configured.",
          retryable: false,
        });
        this.logError(err, this.defaultModel);
        throw err;
      }
      this.client = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
        timeout: getProviderTimeoutMs(),
      });
    }
    return this.client;
  }

  private logError(err: AIProviderError, model: string, attempt?: number): void {
    logAIProviderError({
      provider: "openai",
      model,
      errorType: err.type,
      retryable: err.retryable,
      fallbackAvailable: true,
      message: err.message,
      attempt,
    });
  }

  async generate(request: AIProviderRequest): Promise<AIProviderResponse> {
    const client = this.getClient();
    const model = request.model ?? this.defaultModel;
    const maxRetries = getProviderMaxRetries();
    const timeoutMs = getProviderTimeoutMs();

    let response;
    try {
      response = await withRetry(
        async () => {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), timeoutMs);

          try {
            return await client.chat.completions.create(
              {
                model,
                temperature: request.temperature ?? 0.7,
                max_tokens: request.maxTokens ?? 2000,
                response_format:
                  request.responseFormat === "json"
                    ? { type: "json_object" }
                    : undefined,
                messages: [
                  { role: "system", content: request.systemPrompt },
                  { role: "user", content: request.userPrompt },
                ],
              },
              { signal: controller.signal }
            );
          } catch (err) {
            const classified = mapProviderError(err);
            throw classified;
          } finally {
            clearTimeout(timer);
          }
        },
        { maxRetries, label: "openai.generate" }
      );
    } catch (err) {
      const classified = err instanceof AIProviderError ? err : mapProviderError(err);
      this.logError(classified, model);
      throw classified;
    }

    const content = response.choices[0]?.message?.content;
    if (!content) {
      const err = createInvalidResponseError("OpenAI returned empty content.");
      this.logError(err, model);
      throw err;
    }

    return {
      content,
      raw: response,
      model,
      provider: "openai",
      usage: {
        inputTokens: response.usage?.prompt_tokens,
        outputTokens: response.usage?.completion_tokens,
        totalTokens: response.usage?.total_tokens,
      },
    };
  }
}

export function createOpenAIProvider(): OpenAIProvider {
  return new OpenAIProvider(process.env.OPENAI_DEFAULT_MODEL ?? "gpt-4.1");
}
