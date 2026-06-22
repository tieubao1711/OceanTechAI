import { describe, it, expect } from "vitest";
import { auditConsensusEngine, buildAuditSummary } from "@/server/audit/audit-consensus";
import type { AgentFindingsResult, AgentCritiqueResult } from "@/server/audit/audit-types";
import { emptyProjectKnowledgeSnapshot } from "@/server/knowledge/empty-snapshot";

const snapshot = emptyProjectKnowledgeSnapshot();

function finding(overrides: Partial<AgentFindingsResult["findings"][0]> = {}) {
  return {
    title: "Reputation not used in voting",
    fileOrModule: "src/server/governance/voting.service.ts",
    evidence: "Agent.reputationScore stored but voting weights remain static",
    impact: "Reputation has no behavioral effect on consensus",
    fixScope: "small" as const,
    priority: "high" as const,
    ...overrides,
  };
}

const round1: AgentFindingsResult[] = [
  {
    agentId: "a1",
    agentName: "Sam",
    agentRole: "system_architect",
    findings: [finding()],
    content: "Architect findings",
    concerns: [],
    suggestions: [],
    provider: "mock",
    model: "mock-v1",
    tokenTotal: 500,
    qualityScore: 80,
  },
  {
    agentId: "a2",
    agentName: "Blake",
    agentRole: "backend_engineer",
    findings: [
      finding({
        title: "Execution retry gaps",
        fileOrModule: "src/server/execution/execution.service.ts",
        evidence: "Stops on first GitHub commit failure without idempotent retry",
        priority: "high",
      }),
    ],
    content: "Backend findings",
    concerns: [],
    suggestions: [],
    provider: "mock",
    model: "mock-v1",
    tokenTotal: 500,
    qualityScore: 80,
  },
  {
    agentId: "a3",
    agentName: "Morgan",
    agentRole: "red_team",
    findings: [
      finding({
        title: "Reputation not used in voting",
        fileOrModule: "src/server/governance/voting.service.ts",
        evidence: "Duplicate finding from red team perspective with same module",
        priority: "medium",
      }),
    ],
    content: "Red team findings",
    concerns: [],
    suggestions: [],
    provider: "mock",
    model: "mock-v1",
    tokenTotal: 500,
    qualityScore: 80,
  },
];

describe("audit-consensus", () => {
  it("builds compressed audit summary", () => {
    const summary = buildAuditSummary(round1);
    expect(summary).toContain("Architect Findings");
    expect(summary).toContain("voting.service.ts");
    expect(summary).not.toContain("Previous round messages");
  });

  it("merges duplicate findings", () => {
    const report = auditConsensusEngine.merge({
      round1,
      round2: [],
      snapshot,
      tokenUsage: 1500,
    });
    const votingFindings = report.topFindings.filter((f) =>
      f.title.toLowerCase().includes("reputation")
    );
    expect(votingFindings).toHaveLength(1);
  });

  it("returns top 5 ranked deterministically", () => {
    const report = auditConsensusEngine.merge({
      round1,
      round2: [],
      snapshot,
      tokenUsage: 1500,
    });
    expect(report.topFindings.length).toBeLessThanOrEqual(5);
    expect(report.topFindings[0].priority).toBe("high");
  });

  it("removes findings disputed in round 2", () => {
    const round2: AgentCritiqueResult[] = [
      {
        agentId: "a3",
        agentName: "Morgan",
        agentRole: "red_team",
        critiques: [
          {
            targetFindingTitle: "Execution retry gaps",
            verdict: "disagree",
            reason: "Retry logic exists in commitBatch helper",
          },
        ],
        content: "Critique",
        concerns: [],
        provider: "mock",
        model: "mock-v1",
        tokenTotal: 300,
      },
    ];
    const report = auditConsensusEngine.merge({
      round1,
      round2,
      snapshot,
      tokenUsage: 1800,
    });
    expect(
      report.topFindings.some((f) => f.title === "Execution retry gaps")
    ).toBe(false);
  });

  it("calculates audit score", () => {
    const report = auditConsensusEngine.merge({
      round1,
      round2: [],
      snapshot,
      tokenUsage: 1500,
    });
    expect(report.auditScore.specificity).toBeGreaterThan(0);
    expect(report.auditScore.evidenceQuality).toBeGreaterThan(0);
  });
});
