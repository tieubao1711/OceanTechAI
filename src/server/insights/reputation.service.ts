import { prisma } from "@/server/db/prisma";

export interface ReputationMetrics {
  reputationScore: number;
  acceptanceRate: number;
  participationRate: number;
  avgQualityScore: number;
  acceptedCount: number;
  rejectedCount: number;
  proposalCount: number;
}

export class ReputationService {
  computeScore(metrics: {
    acceptedCount: number;
    rejectedCount: number;
    avgQualityScore: number;
    participationRate: number;
  }): number {
    const total = metrics.acceptedCount + metrics.rejectedCount;
    const acceptanceRate = total > 0 ? metrics.acceptedCount / total : 0.5;
    const qualityBonus = Math.min(metrics.avgQualityScore / 25, 2);
    const participationBonus = Math.min(metrics.participationRate * 2, 1.5);
    const raw = 5 + acceptanceRate * 3 + qualityBonus + participationBonus - 2.5;
    return Math.round(Math.min(10, Math.max(0, raw)) * 10) / 10;
  }

  async updateAfterDebate(discussionId: string) {
    const discussion = await prisma.discussion.findUniqueOrThrow({
      where: { id: discussionId },
      include: {
        rounds: { include: { messages: true } },
      },
    });

    const agentIds = new Set(
      discussion.rounds.flatMap((r) => r.messages.map((m) => m.agentId))
    );

    for (const agentId of agentIds) {
      await prisma.agent.update({
        where: { id: agentId },
        data: { proposalCount: { increment: 1 } },
      });
      await this.recalculateAgent(agentId, discussion.projectId);
    }
  }

  async updateAfterDecision(
    discussionId: string,
    action: "APPROVED" | "REJECTED" | "CHANGES_REQUESTED"
  ) {
    const votes = await prisma.voteRecord.findMany({
      where: { discussionId },
      include: { agent: true },
    });

    for (const vote of votes) {
      if (action === "APPROVED" && vote.vote === "YES") {
        await prisma.agent.update({
          where: { id: vote.agentId },
          data: { acceptedCount: { increment: 1 } },
        });
      } else if (action === "REJECTED" && vote.vote === "YES") {
        await prisma.agent.update({
          where: { id: vote.agentId },
          data: { rejectedCount: { increment: 1 } },
        });
      } else if (action === "CHANGES_REQUESTED") {
        await prisma.agent.update({
          where: { id: vote.agentId },
          data: { rejectedCount: { increment: 0 } },
        });
      }
      await this.recalculateAgent(vote.agentId, vote.agent.projectId);
    }
  }

  async recalculateAgent(agentId: string, projectId: string) {
    const agent = await prisma.agent.findUniqueOrThrow({ where: { id: agentId } });

    const messages = await prisma.agentMessage.findMany({
      where: {
        agentId,
        qualityScore: { not: null },
        round: { discussion: { projectId } },
      },
      select: { qualityScore: true },
    });

    const avgQualityScore =
      messages.length > 0
        ? messages.reduce((s, m) => s + (m.qualityScore ?? 0), 0) / messages.length
        : 70;

    const totalDiscussions = await prisma.discussion.count({
      where: { projectId, status: "COMPLETED" },
    });
    const participationRate =
      totalDiscussions > 0 ? agent.proposalCount / totalDiscussions : 0;

    const total = agent.acceptedCount + agent.rejectedCount;
    const acceptanceRate = total > 0 ? agent.acceptedCount / total : 0.5;

    const reputationScore = this.computeScore({
      acceptedCount: agent.acceptedCount,
      rejectedCount: agent.rejectedCount,
      avgQualityScore,
      participationRate,
    });

    await prisma.agent.update({
      where: { id: agentId },
      data: { reputationScore },
    });

    return {
      reputationScore,
      acceptanceRate,
      participationRate,
      avgQualityScore,
      acceptedCount: agent.acceptedCount,
      rejectedCount: agent.rejectedCount,
      proposalCount: agent.proposalCount,
    } satisfies ReputationMetrics;
  }

  async getTopAgents(projectId: string, limit = 5) {
    return prisma.agent.findMany({
      where: { projectId, isActive: true },
      orderBy: { reputationScore: "desc" },
      take: limit,
    });
  }
}

export const reputationService = new ReputationService();
