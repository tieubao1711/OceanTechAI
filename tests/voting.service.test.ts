import { describe, it, expect } from "vitest";
import { VotingService } from "@/server/governance/voting.service";
import { GovernanceError } from "@/server/errors/governance-error";
import type { Agent, AgentMessage } from "@prisma/client";

const votingService = new VotingService();

function makeVoteMessage(
  overrides: Partial<AgentMessage & { agent: Agent }>
): AgentMessage & { agent: Agent } {
  return {
    id: "msg-1",
    roundId: "round-4",
    agentId: "agent-1",
    stance: "SUPPORT",
    content: "Voting yes",
    concerns: [],
    suggestions: [],
    vote: "YES",
    votingWeightSnapshot: 1.0,
    createdAt: new Date(),
    agent: {
      id: "agent-1",
      projectId: "proj-1",
      name: "Test Agent",
      role: "product_manager",
      expertise: [],
      systemPrompt: "",
      modelProvider: "mock",
      modelName: "mock-v1",
      memorySummary: null,
      toolsAllowed: [],
      votingWeight: 1.0,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    ...overrides,
  };
}

describe("VotingService", () => {
  it("calculates weighted yes votes correctly", () => {
    const messages = [
      makeVoteMessage({ vote: "YES", votingWeightSnapshot: 1.0 }),
      makeVoteMessage({
        id: "msg-2",
        agentId: "agent-2",
        vote: "YES",
        votingWeightSnapshot: 1.0,
        agent: {
          ...makeVoteMessage({}).agent,
          id: "agent-2",
          name: "Agent 2",
        },
      }),
    ];

    const summary = votingService.calculateVoteSummary(messages);
    expect(summary.yes).toBe(2);
    expect(summary.no).toBe(0);
    expect(summary.raw.yes).toBe(2);
  });

  it("applies Red Team weight 1.5 on no vote", () => {
    const messages = [
      makeVoteMessage({ vote: "YES", votingWeightSnapshot: 1.0 }),
      makeVoteMessage({
        id: "msg-2",
        agentId: "red-1",
        vote: "NO",
        votingWeightSnapshot: 1.5,
        concerns: ["Security risk"],
        agent: {
          ...makeVoteMessage({}).agent,
          id: "red-1",
          name: "Morgan — Red Team",
          role: "red_team",
          votingWeight: 1.5,
        },
      }),
    ];

    const summary = votingService.calculateVoteSummary(messages);
    expect(summary.yes).toBe(1);
    expect(summary.no).toBe(1.5);
    expect(summary.redTeamDissent).toBe(true);
    expect(summary.dissenting).toHaveLength(1);
    expect(summary.dissenting[0].role).toBe("red_team");
  });

  it("counts abstain in denominator but not in yes/no", () => {
    const messages = [
      makeVoteMessage({ vote: "YES", votingWeightSnapshot: 1.0 }),
      makeVoteMessage({
        id: "msg-2",
        agentId: "agent-2",
        vote: "ABSTAIN",
        votingWeightSnapshot: 1.0,
        agent: { ...makeVoteMessage({}).agent, id: "agent-2" },
      }),
    ];

    const summary = votingService.calculateVoteSummary(messages);
    expect(summary.yes).toBe(1);
    expect(summary.abstain).toBe(1);
    expect(summary.no).toBe(0);
  });

  it("throws GovernanceError when asserting generate on non-approved", () => {
    try {
      votingService.assertCanGenerateFiles("PENDING");
      expect.fail("Should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(GovernanceError);
      expect((err as GovernanceError).code).toBe("PROPOSAL_APPROVAL_REQUIRED");
    }
  });
});
