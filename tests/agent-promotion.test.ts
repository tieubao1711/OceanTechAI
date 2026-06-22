import { describe, it, expect } from "vitest";
import { nextRank, prevRank } from "@/server/workforce/role-workforce-map";
import { AgentInfluenceService } from "@/server/agents/agent-influence.service";

describe("agent-promotion", () => {
  const influence = new AgentInfluenceService();

  it("promotes through rank ladder", () => {
    expect(nextRank("SENIOR")).toBe("LEAD");
    expect(nextRank("LEAD")).toBe("DIRECTOR");
    expect(nextRank("DIRECTOR")).toBeNull();
  });

  it("demotes through rank ladder", () => {
    expect(prevRank("LEAD")).toBe("SENIOR");
    expect(prevRank("INTERN")).toBeNull();
  });

  it("scores high-influence agents above promotion thresholds", () => {
    const score = influence.calculateScore({
      acceptedCount: 5,
      rejectedCount: 0,
      proposalCount: 6,
      reputationScore: 8.5,
    });
    expect(score).toBeGreaterThanOrEqual(60);
  });

  it("scores low-participation agents below promotion thresholds", () => {
    const score = influence.calculateScore({
      acceptedCount: 0,
      rejectedCount: 2,
      proposalCount: 1,
      reputationScore: 5,
    });
    expect(score).toBeLessThan(60);
  });
});
