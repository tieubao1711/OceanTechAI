import { prisma } from "@/server/db/prisma";
import { journalGenerator } from "./journal-generator";
import type { ConsensusResult } from "@/types/consensus";

export class JournalService {
  async generateFromDebate(discussionId: string, consensus: ConsensusResult) {
    return journalGenerator.generateFromDebate(discussionId, consensus);
  }

  async listByProject(projectId: string, limit = 50) {
    return prisma.agentJournal.findMany({
      where: { projectId },
      include: { agent: { select: { name: true, role: true } } },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }

  async listByDiscussion(discussionId: string) {
    return prisma.agentJournal.findMany({
      where: { discussionId },
      include: { agent: { select: { name: true, role: true } } },
      orderBy: { createdAt: "asc" },
    });
  }
}

export const journalService = new JournalService();
