import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  AIProviderErrorType,
} from "@/server/ai/providers/ai-provider-error";

const mockCreate = vi.fn();

vi.mock("openai", () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: mockCreate,
      },
    },
  })),
}));

describe("OpenAIProvider", () => {
  const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

  beforeEach(() => {
    mockCreate.mockReset();
    vi.stubEnv("OPENAI_API_KEY", "sk-test-key-for-unit-tests");
    vi.stubEnv("OPENAI_DEFAULT_MODEL", "gpt-4o");
    vi.stubEnv("AI_PROVIDER_MAX_RETRIES", "2");
    vi.stubEnv("AI_PROVIDER_TIMEOUT_MS", "60000");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    warnSpy.mockClear();
  });

  async function loadProvider() {
    vi.resetModules();
    const { OpenAIProvider } = await import("@/server/ai/providers/openai-provider");
    return new OpenAIProvider("gpt-4o");
  }

  it("returns content on successful response", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: '{"ok":true}' } }],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    });

    const provider = await loadProvider();
    const result = await provider.generate({
      systemPrompt: "sys",
      userPrompt: "user",
      responseFormat: "json",
    });

    expect(result.content).toBe('{"ok":true}');
    expect(result.provider).toBe("openai");
  });

  it("classifies empty response as INVALID_RESPONSE without retry loop", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: "" } }],
      usage: {},
    });

    const provider = await loadProvider();
    await expect(
      provider.generate({ systemPrompt: "sys", userPrompt: "user" })
    ).rejects.toMatchObject({ type: AIProviderErrorType.INVALID_RESPONSE });

    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it("retries on rate limit then succeeds", async () => {
    mockCreate
      .mockRejectedValueOnce({ status: 429, message: "Rate limit exceeded" })
      .mockResolvedValueOnce({
        choices: [{ message: { content: "done" } }],
        usage: { total_tokens: 1 },
      });

    const provider = await loadProvider();
    const result = await provider.generate({
      systemPrompt: "sys",
      userPrompt: "user",
    });

    expect(result.content).toBe("done");
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it("does not retry authentication failures", async () => {
    mockCreate.mockRejectedValue({ status: 401, message: "Invalid API key" });

    const provider = await loadProvider();
    await expect(
      provider.generate({ systemPrompt: "sys", userPrompt: "user" })
    ).rejects.toMatchObject({ type: AIProviderErrorType.AUTHENTICATION });

    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it("retries timeout errors", async () => {
    const timeoutErr = new Error("Request timed out");
    timeoutErr.name = "AbortError";
    mockCreate
      .mockRejectedValueOnce(timeoutErr)
      .mockResolvedValueOnce({
        choices: [{ message: { content: "recovered" } }],
        usage: {},
      });

    const provider = await loadProvider();
    const result = await provider.generate({
      systemPrompt: "sys",
      userPrompt: "user",
    });

    expect(result.content).toBe("recovered");
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it("logs structured provider errors without API key leakage", async () => {
    mockCreate.mockRejectedValue({
      status: 401,
      message: "Invalid API key sk-supersecretkey1234567890",
    });

    vi.resetModules();
    const observability = await import("@/server/ai/providers/ai-observability");
    const logSpy = vi.spyOn(observability, "logAIProviderError");
    const { OpenAIProvider } = await import("@/server/ai/providers/openai-provider");
    const provider = new OpenAIProvider("gpt-4o");

    await expect(
      provider.generate({ systemPrompt: "sys", userPrompt: "user" })
    ).rejects.toThrow();

    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "openai",
        errorType: AIProviderErrorType.AUTHENTICATION,
        retryable: false,
        fallbackAvailable: true,
      })
    );

    const logged = JSON.stringify(logSpy.mock.calls);
    expect(logged).toContain("errorType");
    expect(logged).toContain("AUTHENTICATION");
    expect(logged).not.toContain("sk-supersecretkey1234567890");
    expect(logged).toContain("sk-[REDACTED]");
  });
});

describe("AgentRunner mock fallback", () => {
  const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

  afterEach(() => {
    warnSpy.mockClear();
  });

  it("falls back to mock when openai provider throws AIProviderError", async () => {
    const { AIProviderError, AIProviderErrorType } = await import(
      "@/server/ai/providers/ai-provider-error"
    );
    const failingProvider = {
      name: "openai" as const,
      isAvailable: () => true,
      generate: vi.fn().mockRejectedValue(
        new AIProviderError({
          type: AIProviderErrorType.AUTHENTICATION,
          message: "Invalid API key",
          retryable: false,
        })
      ),
    };

    const { modelRouter } = await import("@/server/ai/providers/model-router");
    vi.spyOn(modelRouter, "resolveForAgent").mockReturnValue({
      provider: failingProvider,
      providerName: "openai",
      model: "gpt-4o",
      fallbackUsed: false,
    });

    const { AgentRunner } = await import("@/server/agents/agent-runner");
    const runner = new AgentRunner();
    const agent = {
      id: "a1",
      projectId: "p1",
      name: "Test Agent",
      role: "product_manager",
      expertise: [],
      systemPrompt: "test",
      modelProvider: "openai",
      modelName: "gpt-4o",
      memorySummary: null,
      toolsAllowed: [],
      votingWeight: 1,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const { emptyProjectKnowledgeSnapshot } = await import(
      "@/server/knowledge/empty-snapshot"
    );

    const result = await runner.run(
      agent,
      "PROPOSE",
      {
        discussion: {
          id: "d1",
          projectId: "p1",
          userPrompt: "test",
          mode: "normal",
          status: "RUNNING",
          consensusJson: null,
          lastError: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        project: {
          id: "p1",
          name: "P",
          description: null,
          workspaceId: "w1",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        workspace: {
          id: "w1",
          name: "W",
          description: null,
          ownerId: "u1",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        agents: [agent],
        userPrompt: "test",
        memoryContext: "",
        discussionMode: "normal",
        projectKnowledge: "",
        projectKnowledgeSnapshot: emptyProjectKnowledgeSnapshot(),
        round: {
          id: "r1",
          discussionId: "d1",
          roundNumber: 1,
          roundType: "PROPOSE",
          status: "RUNNING",
          createdAt: new Date(),
        },
        previousMessages: [],
      },
      ""
    );

    expect(result.fallbackUsed).toBe(true);
    expect(result.provider).toBe("mock");
    expect(
      warnSpy.mock.calls.some((c) => String(c[0]).includes("[AI:provider-error]"))
    ).toBe(true);

    vi.restoreAllMocks();
  });
});
