import { prisma } from "@/server/db/prisma";

export const TIMELINE_EVENT_TYPES = {
  PROJECT_CREATED: "PROJECT_CREATED",
  DISCUSSION_COMPLETED: "DISCUSSION_COMPLETED",
  PROPOSAL_CREATED: "PROPOSAL_CREATED",
  PROPOSAL_APPROVED: "PROPOSAL_APPROVED",
  PROPOSAL_REJECTED: "PROPOSAL_REJECTED",
  PROPOSAL_CHANGES_REQUESTED: "PROPOSAL_CHANGES_REQUESTED",
  ADR_ACCEPTED: "ADR_ACCEPTED",
  GITHUB_EXECUTED: "GITHUB_EXECUTED",
  SUGGESTION_CREATED: "SUGGESTION_CREATED",
  MILESTONE: "MILESTONE",
} as const;

export class TimelineService {
  async recordEvent(params: {
    projectId: string;
    title: string;
    description?: string;
    eventType: string;
    referenceId?: string;
    occurredAt?: Date;
  }) {
    return prisma.timelineEvent.create({
      data: {
        projectId: params.projectId,
        title: params.title,
        description: params.description,
        eventType: params.eventType,
        referenceId: params.referenceId,
        occurredAt: params.occurredAt ?? new Date(),
      },
    });
  }

  async listByProject(projectId: string, limit = 100) {
    return prisma.timelineEvent.findMany({
      where: { projectId },
      orderBy: { occurredAt: "desc" },
      take: limit,
    });
  }

  async seedProjectMilestones(projectId: string, projectName: string, createdAt: Date) {
    const milestones = [
      {
        title: `${projectName} Created`,
        description: "Project initialized in OceanTechAI Workspace.",
        eventType: TIMELINE_EVENT_TYPES.PROJECT_CREATED,
        occurredAt: createdAt,
      },
      {
        title: "Project Brain created",
        description: "Organizational memory, governance rules, and agent profiles seeded.",
        eventType: TIMELINE_EVENT_TYPES.MILESTONE,
        occurredAt: new Date("2026-06-10"),
      },
      {
        title: "Debate Engine implemented",
        description: "Multi-round AI debate pipeline operational.",
        eventType: TIMELINE_EVENT_TYPES.MILESTONE,
        occurredAt: new Date("2026-06-11"),
      },
      {
        title: "GitHub Execution implemented",
        description: "Approved proposals can be executed to branch, PR, and issues.",
        eventType: TIMELINE_EVENT_TYPES.MILESTONE,
        occurredAt: new Date("2026-06-14"),
      },
      {
        title: "Self-Improvement Organization implemented",
        description: "Journals, recommendations, executive briefing, autonomous suggestions.",
        eventType: TIMELINE_EVENT_TYPES.MILESTONE,
        occurredAt: new Date("2026-06-15"),
      },
    ];

    for (const m of milestones) {
      const exists = await prisma.timelineEvent.findFirst({
        where: { projectId, title: m.title },
      });
      if (!exists) {
        await this.recordEvent({ projectId, ...m });
      }
    }
  }
}

export const timelineService = new TimelineService();
