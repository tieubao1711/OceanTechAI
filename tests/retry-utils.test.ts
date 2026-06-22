import { describe, it, expect, vi } from "vitest";
import { withRetry } from "@/server/ai/providers/retry-utils";
import {
  AIProviderError,
  AIProviderErrorType,
} from "@/server/ai/providers/ai-provider-error";

describe("withRetry", () => {
  it("retries retryable errors up to maxRetries", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(
        new AIProviderError({
          type: AIProviderErrorType.RATE_LIMIT,
          message: "rate limit",
          retryable: true,
        })
      )
      .mockResolvedValueOnce("ok");

    const result = await withRetry(fn, { maxRetries: 2, label: "test" });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("does not retry non-retryable authentication errors", async () => {
    const fn = vi.fn().mockRejectedValue(
      new AIProviderError({
        type: AIProviderErrorType.AUTHENTICATION,
        message: "invalid api key",
        retryable: false,
      })
    );

    await expect(withRetry(fn, { maxRetries: 2, label: "test" })).rejects.toMatchObject({
      type: AIProviderErrorType.AUTHENTICATION,
    });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("does not retry invalid response errors", async () => {
    const fn = vi.fn().mockRejectedValue(
      new AIProviderError({
        type: AIProviderErrorType.INVALID_RESPONSE,
        message: "empty content",
        retryable: false,
      })
    );

    await expect(withRetry(fn, { maxRetries: 2, label: "test" })).rejects.toMatchObject({
      type: AIProviderErrorType.INVALID_RESPONSE,
    });
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
