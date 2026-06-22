import { describe, it, expect } from "vitest";
import {
  DebtStatus,
  transitionDebtOnAuditFind,
  transitionDebtOnProposalApproved,
  transitionDebtOnValidation,
  isDebtResolved,
} from "@/server/learning/integrity/memory-lifecycle";
import { detectRepeatedMistakes } from "@/server/learning/integrity/memory-health";
import { DebtStatus as DebtStatusEnum, type DebtTrackRecord } from "@/server/learning/learning-types";

describe("debt-lifecycle", () => {
  it("transitions OPEN → IMPLEMENTED → VERIFIED", () => {
    expect(transitionDebtOnAuditFind(null)).toBe(DebtStatus.OPEN);
    expect(transitionDebtOnProposalApproved()).toBe(DebtStatus.IMPLEMENTED);
    expect(transitionDebtOnValidation()).toBe(DebtStatus.VERIFIED);
    expect(isDebtResolved(DebtStatus.VERIFIED)).toBe(true);
  });

  it("reopens verified debt when found again in audit", () => {
    expect(transitionDebtOnAuditFind(DebtStatus.VERIFIED)).toBe(DebtStatus.REOPENED);
  });

  it("excludes verified debts from repeated mistakes", () => {
    const audits = [
      {
        consensusJson: {
          topFindings: [
            {
              title: "Debate Token Bloat",
              fileOrModule: "src/server/debate/round-runner.ts",
              evidence: "Large context passed every round without compression",
              impact: "High token cost per debate session",
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
          completedAt: "2026-06-11",
        },
      },
      {
        consensusJson: {
          topFindings: [
            {
              title: "Debate Token Bloat",
              fileOrModule: "src/server/debate/round-runner.ts",
              evidence: "Still passing full memory context each round",
              impact: "Token usage remains high across debates",
              fixScope: "medium",
              priority: "high",
            },
          ],
          strengths: [],
          risks: [],
          recommendations: [],
          tokenUsage: 1200,
          auditScore: {
            specificity: 90,
            evidenceQuality: 90,
            implementationReadiness: 80,
            hallucinationRisk: 10,
          },
          completedAt: "2026-06-12",
        },
      },
    ];

    const verifiedDebt: DebtTrackRecord = {
      title: "OpenAI Provider Error Handling",
      fileOrModule: "src/server/ai/providers/openai-provider.ts",
      status: DebtStatusEnum.VERIFIED,
      topicKey: "error_handling",
      occurrenceCount: 1,
      lastSeenAt: "2026-06-11",
      verifiedAt: "2026-06-11",
    };

    const openDebt: DebtTrackRecord = {
      title: "Debate Token Bloat",
      fileOrModule: "src/server/debate/round-runner.ts",
      status: DebtStatusEnum.OPEN,
      topicKey: "debate_token_bloat",
      occurrenceCount: 4,
      lastSeenAt: "2026-06-12",
    };

    const mistakes = detectRepeatedMistakes(audits, [verifiedDebt, openDebt]);

    expect(mistakes.some((m) => m.title.toLowerCase().includes("error handling"))).toBe(
      false
    );
    expect(mistakes.some((m) => m.title.toLowerCase().includes("token bloat"))).toBe(true);
    expect(mistakes.find((m) => m.title.toLowerCase().includes("token bloat"))?.status).toBe(
      DebtStatusEnum.OPEN
    );
  });
});
