export function getProviderTimeoutMs(): number {
  const val = parseInt(process.env.AI_PROVIDER_TIMEOUT_MS ?? "60000", 10);
  return Number.isFinite(val) && val > 0 ? val : 60000;
}

export function getProviderMaxRetries(): number {
  const val = parseInt(process.env.AI_PROVIDER_MAX_RETRIES ?? "2", 10);
  return Number.isFinite(val) && val >= 0 ? val : 2;
}

export async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

import { AIProviderError, mapProviderError } from "./ai-provider-error";

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: { maxRetries: number; label: string }
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const classified =
        err instanceof AIProviderError ? err : mapProviderError(err);
      lastError = classified;
      const canRetry = classified.retryable && attempt < options.maxRetries;
      if (!canRetry) {
        throw classified;
      }
      const backoff = Math.min(1000 * 2 ** attempt, 8000);
      await sleep(backoff);
    }
  }
  throw lastError;
}
