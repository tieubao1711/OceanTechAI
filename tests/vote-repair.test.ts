import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  repairMissingVote,
  inferVoteFromStance,
  buildVoteRetryPrompt,
  VOTE_REPAIR_CONCERN,
} from "@/server/agents/vote-repair";
import { buildAgentPrompt } from "@/server/agents/agent-prompt-builder";
import { AgentRunner } from "@/server/agents/agent-runner";
import type { AgentMessageContractType } from "@/server/contracts/agent-message.contract";
import type { RoundContext } from "@/types/debate";
import type { Agent, DiscussionRound } from "@prisma/client";
import { emptyProjectKnowledgeSnapshot } from "@/server/knowledge/empty-snapshot";
import { modelRouter } from "@/server/ai/providers/model-router";

function baseMessage(
  overrides: Partial<AgentMessageContractType> = {}
): AgentMessageContractType {
  return {
    agentId: "agent-1",
    round: 4,
    stance: "neutral",
    content: "Voting on the refined architecture audit proposal.",
    concerns: [],
    suggestions: [],
    ...overrides,
  };
}

describe("vote-repair", () => {
  it("support + missing vote → yes", () => {
    const repaired = repairMissingVote(baseMessage({ stance: "support" }), "VOTE");
    expect(repaired.vote).toBe("yes");
    expect(repaired.concerns).toContain(VOTE_REPAIR_CONCERN);
  });

  it("refine + missing vote → yes", () => {
    const repaired = repairMissingVote(baseMessage({ stance: "refine" }), "VOTE");
    expect(repaired.vote).toBe("yes");
  });

  it("oppose + missing vote → no", () => {
    const repaired = repairMissingVote(baseMessage({ stance: "oppose" }), "VOTE");
    expect(repaired.vote).toBe("no");
  });

  it("neutral + missing vote → abstain", () => {
    const repaired = repairMissingVote(baseMessage({ stance: "neutral" }), "VOTE");
    expect(repaired.vote).toBe("abstain");
  });

  it("inferVoteFromStance defaults unknown stance to abstain", () => {
    expect(inferVoteFromStance("neutral")).toBe("abstain");
  });

  it("does not modify non-VOTE rounds", () => {
    const message = baseMessage({ vote: undefined });
    const repaired = repairMissingVote(message, "PROPOSE");
    expect(repaired.vote).toBeUndefined();
  });

  it("buildVoteRetryPrompt requires explicit vote", () => {
    expect(buildVoteRetryPrompt()).toContain('vote: "yes", "no", or "abstain"');
  });

  it("prompt builder Round 4 includes explicit vote requirement", () => {
    const agent: Agent = {
      id: "agent-1",
      projectId: "proj-1",
      name: "Morgan — Red Team",
      role: "red_team",
      expertise: [],
      systemPrompt: "Red team",
      modelProvider: "openai",
      modelName: "gpt-4o",
      memorySummary: null,
      toolsAllowed: [],
      votingWeight: 1.5,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const round: DiscussionRound = {
      id: "round-4",
      discussionId: "disc-1",
      roundNumber: 4,
      roundType: "VOTE",
      status: "RUNNING",
      createdAt: new Date(),
    };

    const context: RoundContext = {
      discussion: {
        id: "disc-1",
        projectId: "proj-1",
        userPrompt: "Architecture audit",
        mode: "architecture_audit",
        status: "RUNNING",
        consensusJson: null,
        lastError: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      project: {
        id: "proj-1",
        name: "OceanTechAI Core",
        description: null,
        workspaceId: "ws-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      workspace: {
        id: "ws-1",
        name: "WS",
        description: null,
        ownerId: "user-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      agents: [agent],
      userPrompt: "Architecture audit",
      memoryContext: "",
      discussionMode: "architecture_audit",
      projectKnowledge: "Existing modules: Debate Engine",
      projectKnowledgeSnapshot: emptyProjectKnowledgeSnapshot(),
      round,
      previousMessages: [],
    };

    const { systemPrompt, userPrompt } = buildAgentPrompt({
      agent,
      roundType: "VOTE",
      context,
      memoryContext: "",
    });

    expect(systemPrompt).toContain('"vote": "yes"');
    expect(userPrompt).toContain("VÒNG 4 — BỎ PHIẾU");
    expect(userPrompt).toContain('"vote": "yes" | "no" | "abstain"');
    expect(systemPrompt).toContain("HIẾN CHƯƠNG OCEANTECHAI");
  });
});

describe("AgentRunner vote repair", () => {
  const agent: Agent = {
    id: "agent-rt",
    projectId: "proj-1",
    name: "Morgan — Red Team Critic",
    role: "red_team",
    expertise: [],
    systemPrompt: "Red team",
    modelProvider: "openai",
    modelName: "gpt-4o",
    memorySummary: null,
    toolsAllowed: [],
    votingWeight: 1.5,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const voteContext: RoundContext = {
    discussion: {
      id: "disc-1",
      projectId: "proj-1",
      userPrompt: "Architecture audit",
      mode: "architecture_audit",
      status: "RUNNING",
      consensusJson: null,
      lastError: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    project: {
      id: "proj-1",
      name: "OceanTechAI Core",
      description: null,
      workspaceId: "ws-1",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    workspace: {
      id: "ws-1",
      name: "WS",
      description: null,
      ownerId: "user-1",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    agents: [agent],
    userPrompt: "Architecture audit",
    memoryContext: "",
    discussionMode: "architecture_audit",
    projectKnowledge: "",
    projectKnowledgeSnapshot: emptyProjectKnowledgeSnapshot(),
    round: {
      id: "round-4",
      discussionId: "disc-1",
      roundNumber: 4,
      roundType: "VOTE",
      status: "RUNNING",
      createdAt: new Date(),
    },
    previousMessages: [],
  };

  const missingVoteJson = JSON.stringify({
    stance: "oppose",
    content: "Critical risks remain unaddressed in execution retry handling.",
    concerns: ["Execution retry gaps still open"],
    suggestions: ["Add idempotent retry in execution.service.ts"],
  });

  beforeEach(() => {
    vi.spyOn(modelRouter, "resolveForAgent").mockReturnValue({
      provider: {
        name: "openai",
        isAvailable: () => true,
        generate: vi.fn().mockResolvedValue({
          content: missingVoteJson,
          model: "gpt-4o",
          provider: "openai",
        }),
      },
      providerName: "openai",
      model: "gpt-4o",
      fallbackUsed: false,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("Round 4 missing vote no longer throws VOTE_REQUIRED", async () => {
    const runner = new AgentRunner();
    const result = await runner.run(agent, "VOTE", voteContext, "");

    expect(result.message.vote).toBe("no");
    expect(result.message.concerns).toContain(VOTE_REPAIR_CONCERN);
    expect(result.qualityScore).toBeLessThan(60);
  });
});
