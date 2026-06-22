import { describe, it, expect } from "vitest";
import {
  buildTopicKey,
  findBestMemoryMatch,
  mergeLearningRecords,
  topicSimilarity,
} from "@/server/learning/integrity/memory-deduplication";
import { MemoryState, type IntegrityLearningRecord } from "@/server/learning/learning-types";

function makeRecord(overrides: Partial<IntegrityLearningRecord>): IntegrityLearningRecord {
  return {
    eventType: "SELF_IMPROVEMENT_COMPLETED",
    title: "Cycle #001 completed",
    summary: "Outcome: verified",
    importance: "high",
    capturedAt: "2026-06-10T00:00:00.000Z",
    state: MemoryState.VERIFIED,
    topicKey: buildTopicKey("Cycle #001 completed", "SELF_IMPROVEMENT_COMPLETED"),
    evidenceCount: 1,
    lastSeenAt: "2026-06-10T00:00:00.000Z",
    references: ["ref-1"],
    ...overrides,
  };
}

describe("memory-deduplication", () => {
  it("detects high similarity for same cycle title", () => {
    expect(
      topicSimilarity(
        "Self-improvement cycle verified: OpenAI Provider Error Handling",
        "Self-improvement cycle verified: OpenAI Provider Error Handling"
      )
    ).toBe(1);
  });

  it("merges duplicate memories instead of creating new", () => {
    const existing = makeRecord({ evidenceCount: 1, references: ["cycle-1"] });
    const incoming = makeRecord({
      evidenceCount: 1,
      lastSeenAt: "2026-06-12T00:00:00.000Z",
      references: ["cycle-2"],
    });

    const merged = mergeLearningRecords(existing, incoming, "cycle-2");
    expect(merged.evidenceCount).toBe(2);
    expect(merged.references).toContain("cycle-1");
    expect(merged.references).toContain("cycle-2");
    expect(merged.lastSeenAt).toBe("2026-06-12T00:00:00.000Z");
  });

  it("matches memories by linked cycle id", () => {
    const candidates = [
      {
        key: "learning_record_test",
        record: makeRecord({ linkedCycleId: "cycle-abc", title: "Cycle #001" }),
      },
    ];

    const match = findBestMemoryMatch(candidates, {
      title: "Self-improvement cycle verified: Cycle #001",
      eventType: "SELF_IMPROVEMENT_COMPLETED",
      topicKey: buildTopicKey("Cycle #001", "SELF_IMPROVEMENT_COMPLETED"),
      linkedCycleId: "cycle-abc",
    });

    expect(match.matched).toBe(true);
    expect(match.score).toBeGreaterThanOrEqual(0.75);
  });
});
