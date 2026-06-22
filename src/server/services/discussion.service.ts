import { prisma } from "@/server/db/prisma";
import { debateOrchestrator } from "@/server/debate/debate-orchestrator";
import { auditOrchestrator } from "@/server/audit/audit-orchestrator";
import { isAuditMode } from "@/types/discussion-mode";
import type { DiscussionMode } from "@/types/discussion-mode";

export class DiscussionService {
  async getById(discussionId: string) {
    return prisma.discussion.findUniqueOrThrow({
      where: { id: discussionId },
      include: {
        project: true,
        proposal: true,
        rounds: {
          orderBy: { roundNumber: "asc" },
          include: {
            messages: {
              include: { agent: true },
              orderBy: { createdAt: "asc" },
            },
          },
        },
      },
    });
  }

  async create(params: {
    projectId: string;
    userPrompt: string;
    mode?: DiscussionMode;
  }) {
    return prisma.discussion.create({
      data: {
        projectId: params.projectId,
        userPrompt: params.userPrompt,
        mode: params.mode ?? "normal",
        status: "DRAFT",
      },
    });
  }

  async createArchitectureAudit(projectId: string, userPrompt?: string) {
    return this.create({
      projectId,
      userPrompt:
        userPrompt ??
        "Perform a complete architecture audit of OceanTechAI and identify the top 5 technical debts blocking future growth.",
      mode: "architecture_audit",
    });
  }

  async runDebate(discussionId: string) {
    const discussion = await prisma.discussion.findUniqueOrThrow({
      where: { id: discussionId },
      select: { mode: true },
    });
    if (isAuditMode(discussion.mode)) {
      return auditOrchestrator.run(discussionId);
    }
    return debateOrchestrator.run(discussionId);
  }
}

export const discussionService = new DiscussionService();
