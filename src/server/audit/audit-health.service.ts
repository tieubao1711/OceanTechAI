import { prisma } from "@/server/db/prisma";
import { parseArchitectureAuditReport } from "./audit-quality";

export class AuditHealthService {
  async getArchitectureHealth(projectId: string) {
    const lastAudit = await prisma.discussion.findFirst({
      where: {
        projectId,
        mode: "architecture_audit",
        status: "COMPLETED",
      },
      orderBy: { updatedAt: "desc" },
      select: { id: true, updatedAt: true, consensusJson: true },
    });

    if (!lastAudit?.consensusJson) return null;

    const report = parseArchitectureAuditReport(lastAudit.consensusJson);
    if (!report) return null;

    const overallScore = Math.round(
      (report.auditScore.specificity +
        report.auditScore.evidenceQuality +
        report.auditScore.implementationReadiness) /
        3
    );

    return {
      discussionId: lastAudit.id,
      lastAuditDate: lastAudit.updatedAt,
      overallScore,
      auditScore: report.auditScore,
      topFindings: report.topFindings,
      tokenUsage: report.tokenUsage,
    };
  }
}

export const auditHealthService = new AuditHealthService();
