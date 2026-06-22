import { describe, it, expect } from "vitest";
import { ReputationService } from "@/server/insights/reputation.service";

describe("ReputationService", () => {
  const service = new ReputationService();

  it("computes higher score for high acceptance and quality", () => {
    const score = service.computeScore({
      acceptedCount: 30,
      rejectedCount: 2,
      avgQualityScore: 85,
      participationRate: 0.8,
    });
    expect(score).toBeGreaterThan(7);
    expect(score).toBeLessThanOrEqual(10);
  });

  it("computes lower score for poor acceptance", () => {
    const score = service.computeScore({
      acceptedCount: 2,
      rejectedCount: 20,
      avgQualityScore: 50,
      participationRate: 0.2,
    });
    expect(score).toBeLessThan(6);
    expect(score).toBeGreaterThanOrEqual(0);
  });

  it("caps score between 0 and 10", () => {
    const high = service.computeScore({
      acceptedCount: 100,
      rejectedCount: 0,
      avgQualityScore: 100,
      participationRate: 1,
    });
    expect(high).toBeLessThanOrEqual(10);

    const low = service.computeScore({
      acceptedCount: 0,
      rejectedCount: 100,
      avgQualityScore: 0,
      participationRate: 0,
    });
    expect(low).toBeGreaterThanOrEqual(0);
  });
});
