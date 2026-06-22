import { prisma } from "@/server/db/prisma";
import { recommendationEngine } from "@/server/recommendations/recommendation-engine";
import { reputationService } from "./reputation.service";

export interface ExecutiveBrief {
  generatedAt: Date;
  openProposals: number;
  pendingReviews: number;
  recentDecisions: number;
  openDiscussions: number;
  topRisks: string[];
  recommendedActions: Awaited<ReturnType<typeof recommendationEngine.generate>>;
  topAgents: Awaited<ReturnType<typeof reputationService.getTopAgents>>;
  recentJournals: Array<{
    id: string;
    title: string;
    type: string;
    agentName: string;
    createdAt: Date;
  }>;
}

export class ExecutiveBriefingService {
  async generateMorningBrief(projectId: string): Promise<ExecutiveBrief> {
    const [
      openProposals,
      pendingReviews,
      recentDecisions,
      openDiscussions,
      pendingProposals,
      journals,
      recommendedActions,
      topAgents,
    ] = await Promise.all([
      prisma.proposal.count({
        where: { discussion: { projectId }, status: "PENDING" },
      }),
      prisma.proposal.count({
        where: { discussion: { projectId }, status: "CHANGES_REQUESTED" },
      }),
      prisma.decisionLog.count({
        where: {
          proposal: { discussion: { projectId } },
          decidedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      }),
      prisma.discussion.count({
        where: { projectId, status: { in: ["DRAFT", "RUNNING"] } },
      }),
      prisma.proposal.findMany({
        where: { discussion: { projectId }, status: "PENDING" },
        select: { risks: true },
        take: 10,
      }),
      prisma.agentJournal.findMany({
        where: { projectId },
        include: { agent: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      recommendationEngine.generate(projectId),
      reputationService.getTopAgents(projectId, 5),
    ]);

    const topRisks = [
      ...new Set(pendingProposals.flatMap((p) => p.risks)),
    ].slice(0, 5);

    if (topRisks.length === 0) {
      topRisks.push("Agent memory quality", "Pending proposal backlog");
    }

    return {
      generatedAt: new Date(),
      openProposals,
      pendingReviews,
      recentDecisions,
      openDiscussions,
      topRisks,
      recommendedActions: recommendedActions.slice(0, 6),
      topAgents,
      recentJournals: journals.map((j) => ({
        id: j.id,
        title: j.title,
        type: j.type,
        agentName: j.agent.name,
        createdAt: j.createdAt,
      })),
    };
  }
}

export const executiveBriefingService = new ExecutiveBriefingService();
