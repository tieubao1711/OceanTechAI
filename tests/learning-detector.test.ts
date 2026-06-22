import { describe, it, expect } from "vitest";
import {
  detectAuditCompleted,
  detectDebtResolved,
  detectExecutionCompleted,
  detectProposalApproved,
  detectResolvedDebts,
  isTopicAlreadySolved,
} from "@/server/learning/learning-detector";
import type { AuditFinding } from "@/server/audit/audit-types";

const finding = (title: string, file: string): AuditFinding => ({
  title,
  fileOrModule: file,
  evidence: "test evidence",
  impact: "medium",
  fixScope: "medium",
  priority: "high",
});

describe("learning-detector", () => {
  it("detects resolved debts between audits", () => {
    const previous = [
      finding("Inadequate Error Handling", "src/server/ai/providers/openai-provider.ts"),
      finding("Missing Tests", "src/server/debate/consensus-engine.ts"),
    ];
    const current = [finding("Missing Tests", "src/server/debate/consensus-engine.ts")];

    const resolved = detectResolvedDebts(previous, current);
    expect(resolved).toHaveLength(1);
    expect(resolved[0].title).toContain("Error Handling");
  });

  it("detects audit completed event", () => {
    const event = detectAuditCompleted({
      topFindings: [finding("Debt A", "src/a.ts")],
      strengths: [],
      risks: [],
      recommendations: [],
      tokenUsage: 1000,
      auditScore: {
        specificity: 90,
        evidenceQuality: 90,
        implementationReadiness: 80,
        hallucinationRisk: 10,
      },
      completedAt: new Date().toISOString(),
    });

    expect(event.type).toBe("AUDIT_COMPLETED");
    expect(event.importance).toBe("high");
  });

  it("detects proposal approved only for APPROVED action", () => {
    const approved = detectProposalApproved({
      title: "Fix provider errors",
      chosenSolution: "Centralized error handling",
      risks: [],
      action: "APPROVED",
    });
    expect(approved?.type).toBe("PROPOSAL_APPROVED");

    const rejected = detectProposalApproved({
      title: "Fix provider errors",
      chosenSolution: "Centralized error handling",
      risks: [],
      action: "REJECTED",
    });
    expect(rejected).toBeNull();
  });

  it("detects execution success", () => {
    const event = detectExecutionCompleted({
      proposalTitle: "Fix errors",
      result: { success: true, prUrl: "https://github.com/pr/1", branchName: "feat/fix" },
    });
    expect(event?.type).toBe("EXECUTION_COMPLETED");
    expect(event?.importance).toBe("high");
  });

  it("detects duplicate topics", () => {
    const result = isTopicAlreadySolved(
      "Inadequate Error Handling in AI Provider",
      ["Debt resolved: Inadequate Error Handling in AI Provider Layer"]
    );
    expect(result.matched).toBe(true);
  });

  it("creates debt resolved event", () => {
    const event = detectDebtResolved(
      finding("Old Debt", "src/old.ts")
    );
    expect(event.type).toBe("DEBT_RESOLVED");
  });
});
