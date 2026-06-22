import { prisma } from "@/server/db/prisma";
import { projectKnowledgeBuilder } from "./project-knowledge-builder";
import type { DiscussionMode, ProjectKnowledgeSnapshot } from "./project-knowledge-types";

export class ProjectKnowledgeService {
  async buildForProject(projectId: string): Promise<ProjectKnowledgeSnapshot> {
    const snapshot = projectKnowledgeBuilder.buildFromFilesystem();

    const adrs = await prisma.adr.findMany({
      where: { projectId },
      orderBy: { number: "asc" },
      take: 10,
    });
    if (adrs.length > 0) {
      snapshot.recentADRs = adrs.map((a) => a.title);
    }

    const decisions = await prisma.agentJournal.findMany({
      where: { projectId, type: "DECISION" },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { title: true },
    });
    if (decisions.length > 0) {
      snapshot.recentDecisions = decisions.map((d) => d.title);
    }

    return snapshot;
  }

  formatForPrompt(snapshot: ProjectKnowledgeSnapshot, mode: DiscussionMode = "normal"): string {
    const sections = [
      "PROJECT KNOWLEDGE SNAPSHOT",
      "You are currently working inside OceanTechAI — not a generic SaaS product.",
      "",
      `Architecture: ${snapshot.architectureSummary}`,
      "",
      "Existing modules:",
      ...snapshot.existingModules.map((m) => `- ${m}`),
      "",
      "Existing services:",
      ...snapshot.existingServices.map((s) => `- ${s}`),
      "",
      "Existing UI pages:",
      ...snapshot.existingPages.map((p) => `- ${p}`),
      "",
      "Existing integrations:",
      ...snapshot.existingIntegrations.map((i) => `- ${i}`),
      "",
      `Existing tests (${snapshot.existingTests.length} files):`,
      ...snapshot.existingTests.slice(0, 15).map((t) => `- ${t}`),
      ...(snapshot.existingTests.length > 15
        ? [`- ...and ${snapshot.existingTests.length - 15} more`]
        : []),
      "",
      "Prisma models:",
      ...snapshot.prismaModels.map((m) => `- ${m}`),
      "",
      "Known constraints:",
      ...snapshot.knownConstraints.map((c) => `- ${c}`),
      "",
      "Recent ADRs:",
      ...snapshot.recentADRs.map((a) => `- ${a}`),
      "",
      "Do NOT recommend adding features that already exist above.",
      "Reference specific modules, services, or files when proposing changes.",
    ];

    if (mode === "architecture_audit") {
      sections.push(
        "",
        "ARCHITECTURE AUDIT MODE",
        "Identify REAL technical debt in OceanTechAI with evidence.",
        "Each finding MUST name a specific module, service, or file.",
        "BAD: 'Need testing', 'Need API versioning', 'Need better architecture'",
        "GOOD: 'execution.service.ts lacks retry idempotency for partial GitHub failures'",
        "",
        "Include a JSON field 'findings' with objects:",
        '{ "title", "evidence", "impact", "priority": "low|medium|high|critical" }',
        "Minimum 1 finding in PROPOSE/CRITIQUE/REFINE rounds with file or module evidence."
      );
    }

    return sections.join("\n");
  }

  /** Compressed file-level context for audit — target <2500 tokens */
  formatForAuditPrompt(snapshot: ProjectKnowledgeSnapshot): string {
    const fileMapLines = snapshot.auditFileMap.flatMap((entry) => [
      `${entry.category}:`,
      ...entry.files.map((f) => `- ${f}`),
      "",
    ]);

    const sections = [
      "PROJECT KNOWLEDGE (AUDIT)",
      "OceanTechAI — findings MUST cite file paths from FILE-LEVEL AUDIT MAP below.",
      "Do not recommend features that already exist. Do not use broad category names as fileOrModule.",
      "",
      "FILE-LEVEL AUDIT MAP",
      ...fileMapLines,
      `Tests: ${snapshot.existingTests.length} files`,
      "",
      "Integrations:",
      ...snapshot.existingIntegrations.map((i) => `- ${i}`),
      "",
      "Constraints:",
      ...snapshot.knownConstraints.slice(0, 4).map((c) => `- ${c}`),
      "",
      "ADRs:",
      ...snapshot.recentADRs.slice(0, 3).map((a) => `- ${a}`),
      "",
      "IMPORTANT:",
      "fileOrModule MUST be a file path from FILE-LEVEL AUDIT MAP.",
      'Do not use "Governance", "External Integrations", or "AI Provider Layer" as fileOrModule.',
      "If unsure, choose the closest file from the map.",
    ];
    return sections.join("\n");
  }
}

export const projectKnowledgeService = new ProjectKnowledgeService();
