import type { AIProviderName } from "./ai-provider";
import type { AIProviderErrorType } from "./ai-provider-error";

export type AICallLog = {
  provider: AIProviderName;
  model: string;
  agentRole: string;
  agentName: string;
  round: number;
  roundType: string;
  fallbackUsed: boolean;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
};

export function logAICall(entry: AICallLog): void {
  const prefix = entry.fallbackUsed ? "[AI:fallback→mock]" : `[AI:${entry.provider}]`;
  const usageStr = entry.usage?.totalTokens
    ? ` tokens=${entry.usage.totalTokens}`
    : "";
  console.info(
    `${prefix} ${entry.agentName} (${entry.agentRole}) round=${entry.round} type=${entry.roundType} model=${entry.model}${usageStr}`
  );
}

export function logAIWarning(message: string, context?: Record<string, unknown>): void {
  console.warn(`[AI:warning] ${message}`, context ?? "");
}

export type AIProviderErrorLog = {
  provider: AIProviderName;
  model: string;
  errorType: AIProviderErrorType;
  retryable: boolean;
  fallbackAvailable: boolean;
  message: string;
  attempt?: number;
};

export function logAIProviderError(entry: AIProviderErrorLog): void {
  const safeMessage = entry.message.replace(/sk-[a-zA-Z0-9_-]{8,}/g, "sk-[REDACTED]");
  console.warn("[AI:provider-error]", {
    provider: entry.provider,
    model: entry.model,
    errorType: entry.errorType,
    retryable: entry.retryable,
    fallbackAvailable: entry.fallbackAvailable,
    message: safeMessage,
    ...(entry.attempt != null ? { attempt: entry.attempt } : {}),
  });
}
