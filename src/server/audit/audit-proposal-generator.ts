import { prisma } from "@/server/db/prisma";
import type { ArchitectureAuditReport } from "./audit-types";

export class AuditProposalGenerator {
  async create(discussionId: string, report: ArchitectureAuditReport) {
    const existing = await prisma.proposal.findUnique({ where: { discussionId } });
    if (existing) return existing;

    const summary = [
      `Architecture Audit — ${report.topFindings.length} prioritized technical debts`,
      "",
      "Audit Scores:",
      `  Specificity: ${report.auditScore.specificity}%`,
      `  Evidence Quality: ${report.auditScore.evidenceQuality}%`,
      `  Implementation Readiness: ${report.auditScore.implementationReadiness}%`,
      `  Hallucination Risk: ${report.auditScore.hallucinationRisk}%`,
      `  Token Usage: ${report.tokenUsage}`,
      "",
      "Top Findings:",
      ...report.topFindings.map(
        (f, i) =>
          `${i + 1}. [${f.priority}/${f.fixScope}] ${f.title}\n   Module: ${f.fileOrModule}\n   Evidence: ${f.evidence}\n   Impact: ${f.impact}`
      ),
    ].join("\n");

    const qualityScore = Math.round(
      (report.auditScore.specificity +
        report.auditScore.evidenceQuality +
        report.auditScore.implementationReadiness) /
        3
    );

    return prisma.proposal.create({
      data: {
        discussionId,
        title: "Architecture Audit: Top Technical Debts",
        summary,
        alternativesConsidered: report.strengths,
        chosenSolution: report.recommendations.join("\n"),
        reasoning: report.topFindings.map((f) => `${f.title} — ${f.evidence}`),
        risks: report.risks,
        filesToCreate: report.topFindings.map(
          (f) => `tasks/audit-${f.title.toLowerCase().replace(/\s+/g, "-").slice(0, 40)}.md`
        ),
        tasksToCreate: report.topFindings.map(
          (f) => `Fix [${f.priority}]: ${f.title} in ${f.fileOrModule}`
        ),
        voteClassification: "audit_consensus",
        qualityScore,
        status: "PENDING",
      },
    });
  }
}

export const auditProposalGenerator = new AuditProposalGenerator();
