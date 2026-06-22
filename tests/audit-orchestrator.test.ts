import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest";
import { prisma } from "@/server/db/prisma";
import { auditOrchestrator } from "@/server/audit/audit-orchestrator";
import { discussionService } from "@/server/services/discussion.service";
import { parseArchitectureAuditReport } from "@/server/audit/audit-quality";

const HAS_DB = !!process.env.DATABASE_URL;

describe.skipIf(!HAS_DB)("AuditOrchestrator (integration)", () => {
  let projectId: string;

  beforeEach(() => {
    vi.stubEnv("AI_PROVIDER_MODE", "mock");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  beforeAll(async () => {
    const project = await prisma.project.findUnique({
      where: { id: "oceantechai-core" },
    });
    if (!project) throw new Error("Run: npm run db:seed");
    projectId = project.id;
  });

  it("runs 3-round focused audit with report in consensusJson", async () => {
    const discussion = await discussionService.createArchitectureAudit(
      projectId,
      "Audit OceanTechAI technical debt"
    );

    const report = await auditOrchestrator.run(discussion.id);

    expect(report.topFindings.length).toBeGreaterThan(0);
    expect(report.tokenUsage).toBeGreaterThan(0);
    expect(report.auditScore.specificity).toBeGreaterThan(50);

    const full = await discussionService.getById(discussion.id);
    expect(full.status).toBe("COMPLETED");
    expect(full.rounds).toHaveLength(3);
    expect(full.proposal).toBeTruthy();

    const stored = parseArchitectureAuditReport(full.consensusJson);
    expect(stored?.topFindings.length).toBe(report.topFindings.length);

    const round1Agents = full.rounds.find((r) => r.roundNumber === 1)!.messages;
    expect(round1Agents.length).toBe(3);
  });
});
