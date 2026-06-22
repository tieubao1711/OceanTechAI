import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { AgentRunner } from "@/server/agents/agent-runner";
import type { RoundContext } from "@/types/debate";
import type { Agent, DiscussionRound } from "@prisma/client";
import { emptyProjectKnowledgeSnapshot } from "@/server/knowledge/empty-snapshot";

describe("AgentRunner", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.stubEnv("AI_PROVIDER_MODE", "mock");
    vi.stubEnv("OPENAI_API_KEY", "");
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.unstubAllEnvs();
  });

  const agent: Agent = {
    id: "agent-pm",
    projectId: "proj-1",
    name: "Alex — Product Manager",
    role: "product_manager",
    expertise: ["scope", "user value"],
    systemPrompt: "You are the Product Manager.",
    modelProvider: "mock",
    modelName: "mock-v1",
    memorySummary: "Founder prefers tight MVP scope.",
    toolsAllowed: [],
    votingWeight: 1,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const round: DiscussionRound = {
    id: "round-1",
    discussionId: "disc-1",
    roundNumber: 1,
    roundType: "PROPOSE",
    status: "RUNNING",
    createdAt: new Date(),
  };

  function buildContext(roundOverrides: Partial<DiscussionRound> = {}): RoundContext {
    return {
      discussion: {
        id: "disc-1",
        projectId: "proj-1",
        userPrompt: "Design Crew System for MMO",
        mode: "normal",
        status: "RUNNING",
        consensusJson: null,
        lastError: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      project: {
        id: "proj-1",
        name: "MMO Project",
        description: "Test",
        workspaceId: "ws-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      workspace: {
        id: "ws-1",
        name: "Test WS",
        description: null,
        ownerId: "user-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      agents: [agent],
      userPrompt: "Design Crew System for MMO",
      memoryContext: "[Global Memory]\n- charter: test",
      discussionMode: "normal",
      projectKnowledge: "",
      projectKnowledgeSnapshot: emptyProjectKnowledgeSnapshot(),
      round: { ...round, ...roundOverrides },
      previousMessages: [],
    };
  }

  const runner = new AgentRunner();

  it("returns contract-valid output for Round 1 (no vote)", async () => {
    const result = await runner.run(agent, "PROPOSE", buildContext(), "");
    expect(result.message.agentId).toBe(agent.id);
    expect(result.message.round).toBe(1);
    expect(result.message.stance).toBeDefined();
    expect(result.message.content.length).toBeGreaterThan(0);
    expect(Array.isArray(result.message.concerns)).toBe(true);
    expect(result.message.vote).toBeUndefined();
    expect(result.qualityScore).toBeGreaterThan(0);
    expect(result.provider).toBe("mock");
  });

  it("Round 4 always includes vote", async () => {
    const result = await runner.run(
      agent,
      "VOTE",
      buildContext({ roundNumber: 4, roundType: "VOTE" }),
      ""
    );
    expect(result.message.round).toBe(4);
    expect(result.message.vote).toMatch(/^(yes|no|abstain)$/);
  });

  it("Red Team Round 4 vote is no with weight scenario", async () => {
    const redTeam: Agent = {
      ...agent,
      id: "agent-rt",
      name: "Morgan — Red Team",
      role: "red_team",
      votingWeight: 1.5,
    };
    const result = await runner.run(
      redTeam,
      "VOTE",
      buildContext({ roundNumber: 4, roundType: "VOTE" }),
      ""
    );
    expect(result.message.vote).toBe("no");
  });
});
