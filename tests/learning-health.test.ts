import { describe, it, expect } from "vitest";
import {
  buildHealthMetrics,
  calculateMemoryHealthScore,
} from "@/server/learning/integrity/memory-health";
import { MemoryState, type IntegrityLearningRecord } from "@/server/learning/learning-types";

describe("learning-health", () => {
  it("calculates high health score for clean memory", () => {
    const score = calculateMemoryHealthScore({
      totalMemories: 10,
      verifiedMemories: 7,
      archivedMemories: 1,
      duplicateMemoriesPrevented: 5,
      openDebts: 1,
      verifiedDebts: 4,
      staleMemories: 0,
    });

    expect(score).toBeGreaterThanOrEqual(85);
  });

  it("penalizes stale and unresolved debts", () => {
    const clean = calculateMemoryHealthScore({
      totalMemories: 10,
      verifiedMemories: 8,
      archivedMemories: 0,
      duplicateMemoriesPrevented: 3,
      openDebts: 1,
      verifiedDebts: 5,
      staleMemories: 0,
    });

    const noisy = calculateMemoryHealthScore({
      totalMemories: 10,
      verifiedMemories: 2,
      archivedMemories: 3,
      duplicateMemoriesPrevented: 0,
      openDebts: 8,
      verifiedDebts: 1,
      staleMemories: 5,
    });

    expect(clean).toBeGreaterThan(noisy);
  });

  it("builds health metrics from records", () => {
    const records: IntegrityLearningRecord[] = [
      {
        eventType: "SELF_IMPROVEMENT_COMPLETED",
        title: "Cycle #001",
        summary: "Verified",
        importance: "high",
        capturedAt: "2026-06-11",
        state: MemoryState.VERIFIED,
        topicKey: "cycle_001",
        evidenceCount: 3,
        lastSeenAt: "2026-06-12",
        references: ["a", "b", "c"],
      },
      {
        eventType: "AUDIT_COMPLETED",
        title: "Audit",
        summary: "Done",
        importance: "medium",
        capturedAt: "2026-06-11",
        state: MemoryState.ACTIVE,
        topicKey: "audit",
        evidenceCount: 1,
        lastSeenAt: "2026-06-12",
        references: ["d"],
      },
    ];

    const metrics = buildHealthMetrics({
      records,
      debtTracks: [],
      stats: { duplicateMemoriesPrevented: 2 },
    });

    expect(metrics.totalMemories).toBe(2);
    expect(metrics.verifiedMemories).toBe(1);
    expect(metrics.activeMemories).toBe(1);
    expect(metrics.duplicateMemoriesPrevented).toBe(2);
    expect(metrics.memoryHealthScore).toBeGreaterThan(0);
  });
});
