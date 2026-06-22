import { describe, it, expect } from "vitest";
import {
  summarizeLearningEvent,
  truncateSummary,
  buildMemoryKey,
  parseLearningMemoryValue,
} from "@/server/learning/learning-summary";

describe("learning-summary", () => {
  it("summarizes events compactly", () => {
    const summary = summarizeLearningEvent({
      type: "DEBT_RESOLVED",
      title: "Debt resolved: Error handling",
      evidence: ["src/server/ai/providers/openai-provider.ts", "Fixed in cycle 001"],
      outcome: "Debt no longer in audit",
      importance: "high",
    });

    expect(summary.eventType).toBe("DEBT_RESOLVED");
    expect(summary.summary.length).toBeLessThanOrEqual(480);
    expect(summary.summary).toContain("Error handling");
  });

  it("truncates long summaries", () => {
    const long = "x".repeat(600);
    expect(truncateSummary(long).length).toBe(480);
    expect(truncateSummary(long).endsWith("...")).toBe(true);
  });

  it("builds stable memory keys", () => {
    const key = buildMemoryKey("DEBT_RESOLVED", "Error Handling Fix");
    expect(key).toMatch(/^learning_debt_resolved_/);
  });

  it("parses stored memory JSON", () => {
    const stored = JSON.stringify({
      eventType: "EXECUTION_COMPLETED",
      title: "Executed",
      summary: "PR created",
      importance: "high",
      capturedAt: "2026-06-11T00:00:00.000Z",
    });
    const parsed = parseLearningMemoryValue(stored);
    expect(parsed?.eventType).toBe("EXECUTION_COMPLETED");
  });
});
