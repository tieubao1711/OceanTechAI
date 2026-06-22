import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockIntegrity, mockRecordEvent, mockPrisma } = vi.hoisted(() => ({
  mockIntegrity: {
    recordLearningEvent: vi.fn(async () => ({ record: {}, merged: false })),
    registerDebtFromAudit: vi.fn(async () => ({})),
    markDebtVerified: vi.fn(async () => ({})),
    markDebtImplemented: vi.fn(async () => undefined),
    openOrLinkImprovementCycle: vi.fn(async () => ({ id: "cycle-1" })),
    verifyCycleForDebt: vi.fn(async () => ({ id: "cycle-1", title: "Test Cycle" })),
    getLearningCenterData: vi.fn(async () => ({
      health: { memoryHealthScore: 92 },
      activeLearnings: [],
      verifiedImprovements: [],
      reopenedProblems: [],
      repeatedMistakes: [],
      openCycles: [],
    })),
    repairProject: vi.fn(async () => ({
      memoriesMerged: 3,
      memoriesArchived: 0,
      legacyRemoved: 3,
      cyclesDeduped: 1,
      canonicalRecords: 1,
    })),
  },
  mockRecordEvent: vi.fn(async () => ({})),
  mockPrisma: {
    discussion: { findFirst: vi.fn() },
    improvementCycle: {
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    adr: {
      aggregate: vi.fn(async () => ({ _max: { number: 4 } })),
      findFirst: vi.fn(async () => null),
      create: vi.fn(async (args: { data: object }) => ({ id: "adr-draft-1", ...args.data })),
      findMany: vi.fn(async () => []),
    },
  },
}));

vi.mock("@/server/learning/integrity/memory-integrity.service", () => ({
  memoryIntegrityService: mockIntegrity,
}));

vi.mock("@/server/insights/timeline.service", () => ({
  timelineService: { recordEvent: mockRecordEvent },
  TIMELINE_EVENT_TYPES: {
    GITHUB_EXECUTED: "GITHUB_EXECUTED",
    MILESTONE: "MILESTONE",
  },
}));

vi.mock("@/server/db/prisma", () => ({ prisma: mockPrisma }));

import { LearningCaptureService } from "@/server/learning/learning-capture.service";

const sampleReport = {
  topFindings: [
    {
      title: "Inadequate Error Handling",
      fileOrModule: "src/server/ai/providers/openai-provider.ts",
      evidence: "No classification in provider error path",
      impact: "High risk of silent failures in production",
      fixScope: "medium" as const,
      priority: "high" as const,
    },
  ],
  strengths: [],
  risks: [],
  recommendations: [],
  tokenUsage: 5000,
  auditScore: {
    specificity: 90,
    evidenceQuality: 90,
    implementationReadiness: 80,
    hallucinationRisk: 10,
  },
  completedAt: new Date().toISOString(),
};

describe("LearningCaptureService", () => {
  const service = new LearningCaptureService();

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.discussion.findFirst.mockResolvedValue(null);
  });

  it("delegates audit capture to integrity service", async () => {
    const result = await service.captureFromAudit({
      projectId: "proj-1",
      discussionId: "disc-1",
      report: sampleReport,
      proposalId: "prop-1",
    });

    expect(result.eventsCaptured).toBeGreaterThan(0);
    expect(mockIntegrity.registerDebtFromAudit).toHaveBeenCalled();
    expect(mockIntegrity.recordLearningEvent).toHaveBeenCalled();
    expect(mockIntegrity.openOrLinkImprovementCycle).toHaveBeenCalled();
  });

  it("delegates debt resolution to integrity service", async () => {
    mockPrisma.discussion.findFirst.mockResolvedValue({
      consensusJson: {
        ...sampleReport,
        topFindings: [
          {
            title: "Old Debt Removed",
            fileOrModule: "src/old.ts",
            evidence: "Legacy module lacks error handling and tests",
            impact: "High maintenance risk for future changes",
            fixScope: "small",
            priority: "high",
          },
        ],
      },
    });

    await service.captureFromAudit({
      projectId: "proj-1",
      discussionId: "disc-2",
      report: { ...sampleReport, topFindings: [] },
    });

    expect(mockIntegrity.markDebtVerified).toHaveBeenCalled();
    expect(mockIntegrity.verifyCycleForDebt).toHaveBeenCalled();
  });

  it("records timeline event on execution success", async () => {
    await service.captureFromExecution({
      projectId: "proj-1",
      proposalId: "prop-1",
      proposalTitle: "Fix errors",
      result: { success: true, prUrl: "https://github.com/pr/1", branchName: "feat/fix" },
    });

    expect(mockRecordEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "GITHUB_EXECUTED" })
    );
    expect(mockIntegrity.recordLearningEvent).toHaveBeenCalled();
  });

  it("creates ADR draft for high-importance approved proposals", async () => {
    await service.captureFromProposalApproval({
      projectId: "proj-1",
      proposalId: "prop-2",
      title: "Security hardening",
      chosenSolution: "Add auth checks",
      risks: ["Security exposure"],
      action: "APPROVED",
      discussionId: "disc-4",
    });

    expect(mockPrisma.adr.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "DRAFT" }),
      })
    );
    expect(mockIntegrity.markDebtImplemented).toHaveBeenCalled();
  });
});
