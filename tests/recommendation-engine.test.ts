import { describe, it, expect, vi, beforeEach } from "vitest";
import { RecommendationEngine } from "@/server/recommendations/recommendation-engine";

vi.mock("@/server/learning/integrity/topic-lifecycle.service", () => ({
  topicLifecycleService: {
    loadLifecycleMap: vi.fn(async () => new Map()),
  },
}));

vi.mock("@/server/db/prisma", () => ({
  prisma: {
    proposal: {
      count: vi.fn(async () => 2),
      findMany: vi.fn(async () => [
        {
          title: "Old Feature",
          risks: ["Inflation risk"],
          status: "REJECTED",
        },
      ]),
    },
    agentJournal: {
      findMany: vi.fn(async () => [
        {
          title: "Reputation needed",
          content: "We should implement agent reputation system across discussions",
          agent: { role: "product_manager", name: "Alex" },
        },
        {
          title: "Memory issue",
          content: "Agent memory quality degrades over long debates",
          agent: { role: "system_architect", name: "Sam" },
        },
      ]),
    },
    discussion: {
      findMany: vi.fn(async () => [
        { userPrompt: "Add agent reputation tracking", status: "COMPLETED" },
        { userPrompt: "Improve memory quality", status: "COMPLETED" },
      ]),
    },
    adr: {
      findMany: vi.fn(async () => [
        { title: "ADR-001", summary: "AI debate engine", slug: "ai-debate" },
      ]),
    },
    autonomousSuggestion: {
      findMany: vi.fn(async () => []),
    },
  },
}));

describe("RecommendationEngine", () => {
  const engine = new RecommendationEngine();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generates prioritized actions from project signals", async () => {
    const actions = await engine.generate("proj-1");

    expect(actions.length).toBeGreaterThan(0);
    expect(actions[0].priority).toBe(1);
    expect(actions.some((a) => a.title.includes("Open Proposal"))).toBe(true);
    expect(actions.some((a) => a.title.includes("Agent Reputation"))).toBe(true);
  });

  it("includes rejected proposal revisit actions", async () => {
    const actions = await engine.generate("proj-1");
    expect(actions.some((a) => a.source === "rejected_proposal")).toBe(true);
  });
});
