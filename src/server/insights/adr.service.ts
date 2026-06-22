import { prisma } from "@/server/db/prisma";

const DEFAULT_ADRS = [
  {
    number: 1,
    slug: "ai-debate",
    title: "ADR-001: AI Debate Required",
    status: "ACCEPTED",
    summary: "All significant decisions require multi-round AI debate before proposal.",
    filePath: "docs/decisions/ADR-001-AI-DEBATE.md",
  },
  {
    number: 2,
    slug: "human-approval",
    title: "ADR-002: Human Approval Required",
    status: "ACCEPTED",
    summary: "Founder approval mandatory before generated files and GitHub execution.",
    filePath: "docs/decisions/ADR-002-HUMAN-APPROVAL.md",
  },
  {
    number: 3,
    slug: "markdown-source-of-truth",
    title: "ADR-003: Markdown as Source of Truth",
    status: "ACCEPTED",
    summary: "Approved proposals generate Markdown docs as the canonical project artifact.",
    filePath: "docs/decisions/ADR-003-MARKDOWN-SOURCE.md",
  },
  {
    number: 4,
    slug: "self-improvement-founder-approval",
    title: "ADR-004: Self-Improvement Requires Founder Approval",
    status: "ACCEPTED",
    summary: "Autonomous suggestions and improvements still require Founder action — no auto-execute.",
    filePath: "docs/decisions/ADR-004-SELF-IMPROVEMENT.md",
  },
];

export class AdrService {
  async seedForProject(projectId: string) {
    for (const adr of DEFAULT_ADRS) {
      await prisma.adr.upsert({
        where: { projectId_number: { projectId, number: adr.number } },
        update: {},
        create: { projectId, ...adr },
      });
    }
  }

  async listByProject(projectId: string) {
    return prisma.adr.findMany({
      where: { projectId },
      orderBy: { number: "asc" },
    });
  }
}

export const adrService = new AdrService();
