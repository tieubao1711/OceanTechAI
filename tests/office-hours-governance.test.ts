import { describe, it, expect } from "vitest";
import { assertAgentCanChat } from "@/server/office-hours/office-hours-governance";
import { GovernanceError } from "@/server/errors/governance-error";
import type { Agent } from "@prisma/client";

function agent(overrides: Partial<Agent>): Agent {
  return {
    id: "a1",
    projectId: "p1",
    name: "Sam",
    role: "system_architect",
    department: "ENGINEERING",
    title: "Lead Architect",
    rank: "LEAD",
    managerAgentId: null,
    workforceStatus: "ACTIVE",
    avatarType: "CORPORATE",
    avatarSeed: "sam",
    expertise: [],
    systemPrompt: "Architect",
    modelProvider: "mock",
    modelName: "mock-v1",
    memorySummary: null,
    toolsAllowed: [],
    votingWeight: 1,
    isActive: true,
    reputationScore: 8,
    acceptedCount: 5,
    rejectedCount: 0,
    proposalCount: 4,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("office-hours-governance", () => {
  it("allows active agents to chat", () => {
    expect(() => assertAgentCanChat(agent({}))).not.toThrow();
  });

  it("blocks retired agents", () => {
    expect(() =>
      assertAgentCanChat(agent({ workforceStatus: "RETIRED", isActive: false }))
    ).toThrow(GovernanceError);
  });

  it("blocks suspended agents", () => {
    expect(() =>
      assertAgentCanChat(agent({ workforceStatus: "SUSPENDED", isActive: false }))
    ).toThrow(GovernanceError);
  });

  it("blocks inactive agents", () => {
    expect(() => assertAgentCanChat(agent({ isActive: false }))).toThrow(GovernanceError);
  });
});
