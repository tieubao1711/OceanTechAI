import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ModelRouter } from "@/server/ai/providers/model-router";

describe("ModelRouter", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("OPENAI_DEFAULT_MODEL", "gpt-4.1");
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.unstubAllEnvs();
  });

  const mockAgent = {
    id: "agent-1",
    projectId: "proj-1",
    name: "Alex — PM",
    role: "product_manager",
    expertise: [],
    systemPrompt: "PM role",
    modelProvider: "mock",
    modelName: "mock-v1",
    memorySummary: null,
    toolsAllowed: [],
    votingWeight: 1,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it("uses mock provider in mock mode", () => {
    vi.stubEnv("AI_PROVIDER_MODE", "mock");
    const router = new ModelRouter();
    const resolved = router.resolveForAgent(mockAgent);
    expect(resolved.providerName).toBe("mock");
    expect(resolved.fallbackUsed).toBe(false);
  });

  it("falls back to mock in openai mode when key missing", () => {
    vi.stubEnv("AI_PROVIDER_MODE", "openai");
    vi.stubEnv("OPENAI_API_KEY", "");
    const router = new ModelRouter();
    const resolved = router.resolveForAgent(mockAgent);
    expect(resolved.providerName).toBe("mock");
    expect(resolved.fallbackUsed).toBe(true);
    expect(resolved.fallbackReason).toBe("missing_openai_key");
  });

  it("uses openai in openai mode when key present", () => {
    vi.stubEnv("AI_PROVIDER_MODE", "openai");
    vi.stubEnv("OPENAI_API_KEY", "sk-test-key");
    const router = new ModelRouter();
    const resolved = router.resolveForAgent(mockAgent);
    expect(resolved.providerName).toBe("openai");
    expect(resolved.fallbackUsed).toBe(false);
    expect(resolved.model).toBe("gpt-4.1");
  });

  it("uses default model when agent still has mock-v1 modelName in openai mode", () => {
    vi.stubEnv("AI_PROVIDER_MODE", "openai");
    vi.stubEnv("OPENAI_API_KEY", "sk-test-key");
    vi.stubEnv("OPENAI_DEFAULT_MODEL", "gpt-4o");
    const router = new ModelRouter();
    const resolved = router.resolveForAgent(mockAgent);
    expect(resolved.providerName).toBe("openai");
    expect(resolved.model).toBe("gpt-4o");
  });

  it("hybrid uses mock for agent with mock provider", () => {
    vi.stubEnv("AI_PROVIDER_MODE", "hybrid");
    vi.stubEnv("OPENAI_API_KEY", "sk-test-key");
    const router = new ModelRouter();
    const resolved = router.resolveForAgent(mockAgent);
    expect(resolved.providerName).toBe("mock");
    expect(resolved.fallbackUsed).toBe(false);
  });

  it("hybrid uses openai for agent with openai provider when key present", () => {
    vi.stubEnv("AI_PROVIDER_MODE", "hybrid");
    vi.stubEnv("OPENAI_API_KEY", "sk-test-key");
    const router = new ModelRouter();
    const resolved = router.resolveForAgent({
      ...mockAgent,
      modelProvider: "openai",
      modelName: "gpt-4.1",
    });
    expect(resolved.providerName).toBe("openai");
    expect(resolved.fallbackUsed).toBe(false);
    expect(resolved.model).toBe("gpt-4.1");
  });

  it("hybrid falls back to mock when agent wants openai but key missing", () => {
    vi.stubEnv("AI_PROVIDER_MODE", "hybrid");
    vi.stubEnv("OPENAI_API_KEY", "");
    const router = new ModelRouter();
    const resolved = router.resolveForAgent({
      ...mockAgent,
      modelProvider: "openai",
    });
    expect(resolved.providerName).toBe("mock");
    expect(resolved.fallbackUsed).toBe(true);
    expect(resolved.fallbackReason).toBe("openai_unavailable");
  });
});
