import { describe, it, expect } from "vitest";
import { AgentInfluenceService } from "@/server/agents/agent-influence.service";

describe("agent-influence.service", () => {
  const service = new AgentInfluenceService();

  it("calculates higher score for active trusted agents", () => {
    const high = service.calculateScore({
      acceptedCount: 10,
      rejectedCount: 1,
      proposalCount: 8,
      reputationScore: 8.5,
      warningJournalCount: 2,
    });
    const low = service.calculateScore({
      acceptedCount: 0,
      rejectedCount: 5,
      proposalCount: 1,
      reputationScore: 4,
    });
    expect(high).toBeGreaterThan(low);
    expect(high).toBeLessThanOrEqual(100);
  });

  it("returns zero for inactive agent with no participation", () => {
    const score = service.calculateScore({
      acceptedCount: 0,
      rejectedCount: 0,
      proposalCount: 0,
      reputationScore: 0,
    });
    expect(score).toBe(0);
  });

  it("caps influence at 100", () => {
    const score = service.calculateScore({
      acceptedCount: 50,
      rejectedCount: 0,
      proposalCount: 20,
      reputationScore: 10,
      verifiedImprovements: 10,
      warningJournalCount: 10,
    });
    expect(score).toBe(100);
  });
});
