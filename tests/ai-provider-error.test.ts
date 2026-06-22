import { describe, it, expect } from "vitest";
import {
  AIProviderError,
  AIProviderErrorType,
  mapProviderError,
  sanitizeProviderMessage,
  createInvalidResponseError,
} from "@/server/ai/providers/ai-provider-error";

describe("ai-provider-error", () => {
  it("maps timeout errors as retryable", () => {
    const abortErr = new Error("The operation timed out");
    abortErr.name = "AbortError";
    const err = mapProviderError(abortErr);
    expect(err.type).toBe(AIProviderErrorType.TIMEOUT);
    expect(err.retryable).toBe(true);
  });

  it("maps rate limit errors as retryable", () => {
    const err = mapProviderError({ status: 429, message: "Rate limit reached" });
    expect(err.type).toBe(AIProviderErrorType.RATE_LIMIT);
    expect(err.retryable).toBe(true);
  });

  it("maps authentication errors as non-retryable", () => {
    const err = mapProviderError({ status: 401, message: "Invalid API key provided" });
    expect(err.type).toBe(AIProviderErrorType.AUTHENTICATION);
    expect(err.retryable).toBe(false);
  });

  it("maps network errors as retryable", () => {
    const err = mapProviderError(new Error("fetch failed: ECONNRESET"));
    expect(err.type).toBe(AIProviderErrorType.NETWORK);
    expect(err.retryable).toBe(true);
  });

  it("creates invalid response errors as non-retryable", () => {
    const err = createInvalidResponseError("OpenAI returned empty content.");
    expect(err.type).toBe(AIProviderErrorType.INVALID_RESPONSE);
    expect(err.retryable).toBe(false);
  });

  it("sanitizes API keys from messages", () => {
    const sanitized = sanitizeProviderMessage("Auth failed for sk-secretkey1234567890abcdef");
    expect(sanitized).not.toContain("sk-secretkey1234567890abcdef");
    expect(sanitized).toContain("sk-[REDACTED]");
  });
});
