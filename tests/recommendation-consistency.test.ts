import { describe, it, expect } from "vitest";
import { DebtStatus, MemoryState } from "@/server/learning/learning-types";
import { detectRepeatedMistakes } from "@/server/learning/integrity/memory-health";
import {
  isTopicVerified,
  type VerifiedTopicSnapshot,
} from "@/server/learning/integrity/resolved-topics";
import { RecommendationConsistencyService } from "@/server/learning/integrity/recommendation-consistency.service";
import { resolveCanonicalTopic } from "@/server/learning/integrity/topic-resolver";
import type { TopicLifecycle } from "@/server/learning/integrity/topic-lifecycle.service";

const verifiedSnapshot: VerifiedTopicSnapshot = {
  entries: [
    {
      topicKey: "agent_reputation_voting",
      title: "Agent Reputation in Voting",
      source: "cycle",
      status: "VERIFIED",
    },
    {
      topicKey: "execution_retry_gaps",
      title: "Execution Retry Gaps",
      source: "debt",
      status: DebtStatus.VERIFIED,
    },
  ],
};

function lifecycleMap(entries: TopicLifecycle[]) {
  return new Map(entries.map((e) => [e.topicKey, e]));
}

const verifiedLifecycleMap = lifecycleMap([
  {
    topicKey: "agent_reputation_voting",
    canonicalTitle: "Agent Reputation in Voting",
    status: "VERIFIED",
    source: "improvement_cycle",
    evidence: ["cycle:1:VERIFIED"],
  },
  {
    topicKey: "execution_retry_gaps",
    canonicalTitle: "Execution Retry Gaps",
    status: "VERIFIED",
    source: "debt_track",
    evidence: ["debt:Execution retry gaps:VERIFIED"],
  },
]);

const auditFinding = (title: string) => ({
  consensusJson: {
    topFindings: [
      {
        title,
        fileOrModule: "src/server/example.ts",
        evidence: "Detailed evidence for audit finding validation",
        impact: "High impact on system reliability and maintainability",
        fixScope: "medium",
        priority: "high",
      },
    ],
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
    completedAt: "2026-06-12",
  },
});

describe("recommendation-consistency", () => {
  const service = new RecommendationConsistencyService();

  it("excludes VERIFIED debt from repeated mistakes", () => {
    const audits = [
      auditFinding("Reputation not used in voting"),
      auditFinding("Reputation not used in voting"),
    ];

    const mistakes = detectRepeatedMistakes(
      audits,
      [
        {
          title: "Reputation not used in voting",
          fileOrModule: "src/server/governance/voting.service.ts",
          status: DebtStatus.VERIFIED,
          topicKey: "agent_reputation_voting",
          occurrenceCount: 2,
          lastSeenAt: "2026-06-12",
          verifiedAt: "2026-06-12",
        },
      ],
      2,
      verifiedLifecycleMap
    );

    expect(mistakes.some((m) => m.title.toLowerCase().includes("reputation"))).toBe(
      false
    );
  });

  it("excludes IMPLEMENTED debt from repeated mistakes", () => {
    const audits = [
      auditFinding("Execution retry gaps"),
      auditFinding("Execution retry gaps"),
    ];

    const mistakes = detectRepeatedMistakes(
      audits,
      [
        {
          title: "Execution retry gaps",
          fileOrModule: "src/server/execution/execution.service.ts",
          status: DebtStatus.IMPLEMENTED,
          topicKey: "execution_retry_gaps",
          occurrenceCount: 3,
          lastSeenAt: "2026-06-12",
        },
      ],
      2,
      verifiedLifecycleMap
    );

    expect(mistakes.some((m) => m.title.toLowerCase().includes("execution"))).toBe(
      false
    );
  });

  it("includes REOPENED debt in repeated mistakes", () => {
    const audits = [
      auditFinding("Debate Token Bloat"),
      auditFinding("Debate Token Bloat"),
    ];

    const mistakes = detectRepeatedMistakes(
      audits,
      [
        {
          title: "Debate Token Bloat",
          fileOrModule: "src/server/debate/round-runner.ts",
          status: DebtStatus.REOPENED,
          topicKey: "debate_token_bloat",
          occurrenceCount: 4,
          lastSeenAt: "2026-06-12",
        },
      ],
      2,
      verifiedLifecycleMap
    );

    expect(mistakes.some((m) => m.title.toLowerCase().includes("token bloat"))).toBe(
      true
    );
    expect(mistakes.find((m) => m.title.toLowerCase().includes("token bloat"))?.status).toBe(
      DebtStatus.REOPENED
    );
  });

  it("detects verified topics for recommendation filtering", () => {
    expect(isTopicVerified("Implement Agent Reputation", verifiedSnapshot)).toBe(true);
    expect(isTopicVerified("Fix Execution Retry Gaps", verifiedSnapshot)).toBe(true);
    expect(isTopicVerified("Debate Token Bloat", verifiedSnapshot)).toBe(false);
  });

  it("resolves related phrases to the same canonical topic key", () => {
    expect(resolveCanonicalTopic("Implement Agent Reputation").topicKey).toBe(
      resolveCanonicalTopic("Reputation not used in voting").topicKey
    );
  });

  it("deduplicates by topicKey not only title", () => {
    const deduped = service.dedupeByTopicKey([
      { title: "Cycle #001 completed", topicKey: "self_improvement_cycle_001" },
      { title: "Self-improvement cycle verified: Cycle #001", topicKey: "self_improvement_cycle_001" },
      { title: "Different topic", topicKey: "different_topic" },
    ]);

    expect(deduped).toHaveLength(2);
  });

  it("flags inconsistent recommendations against verified improvements with topicKey", () => {
    const report = service.check({
      lifecycleMap: verifiedLifecycleMap,
      recommendedActions: [
        {
          priority: 1,
          title: "Implement Agent Reputation",
          reason: "Mentioned in journals",
          source: "topic_analysis",
        },
      ],
      repeatedMistakes: [],
      activeLearnings: [],
      verifiedImprovementTitles: ["Reputation not used in voting"],
    });

    expect(report.consistent).toBe(false);
    expect(report.issues[0]?.topicKey).toBe("agent_reputation_voting");
  });

  it("flags verified topics in active learnings", () => {
    const report = service.check({
      lifecycleMap: verifiedLifecycleMap,
      recommendedActions: [],
      repeatedMistakes: [],
      activeLearnings: [
        {
          eventType: "AUDIT_COMPLETED",
          title: "Reputation not used in voting",
          summary: "Still active",
          importance: "high",
          capturedAt: "2026-06-12",
          state: MemoryState.ACTIVE,
          topicKey: "agent_reputation_voting",
          evidenceCount: 1,
          lastSeenAt: "2026-06-12",
          references: ["ref-1"],
        },
      ],
      verifiedImprovementTitles: ["Agent Reputation in Voting"],
    });

    expect(report.consistent).toBe(false);
    expect(report.issues.some((i) => i.topicKey === "agent_reputation_voting")).toBe(true);
  });

  it("passes when verified topics are not recommended or repeated", () => {
    const report = service.check({
      lifecycleMap: verifiedLifecycleMap,
      recommendedActions: [
        {
          priority: 1,
          title: "Review 2 Open Proposals",
          reason: "Founder approval required",
          source: "open_proposals",
        },
      ],
      repeatedMistakes: [
        {
          title: "Debate Token Bloat",
          status: DebtStatus.OPEN,
          occurrenceCount: 4,
          topicKey: "debate_token_bloat",
        },
      ],
      activeLearnings: [],
      verifiedImprovementTitles: [
        "Reputation not used in voting",
        "Execution retry gaps",
      ],
    });

    expect(report.consistent).toBe(true);
  });

  it("includes reopened topics in repeated mistakes lifecycle", () => {
    const reopenedMap = lifecycleMap([
      {
        topicKey: "debate_token_bloat",
        canonicalTitle: "Debate Token Bloat",
        status: "REOPENED",
        source: "debt_track",
        evidence: ["debt:Debate Token Bloat:REOPENED"],
      },
    ]);

    const report = service.check({
      lifecycleMap: reopenedMap,
      recommendedActions: [],
      repeatedMistakes: [
        {
          title: "Debate Token Bloat",
          status: DebtStatus.REOPENED,
          occurrenceCount: 3,
          topicKey: "debate_token_bloat",
        },
      ],
      activeLearnings: [],
      verifiedImprovementTitles: [],
    });

    expect(report.consistent).toBe(true);
  });
});
