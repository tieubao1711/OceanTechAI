import { prisma } from "@/server/db/prisma";
import { agentIdentityService } from "./agent-identity.service";
import type { AgentCouncilMember, CouncilInsights } from "./agent-types";

const INACTIVE_DAYS = 30;
const LOW_REPUTATION_THRESHOLD = 5.5;

export class AgentCouncilService {
  async getCouncilMembers(projectId: string): Promise<AgentCouncilMember[]> {
    const agents = await prisma.agent.findMany({
      where: { projectId },
      orderBy: { reputationScore: "desc" },
    });

    const members = await Promise.all(
      agents.map((a) => agentIdentityService.buildCouncilMember(a, projectId))
    );

    return members.sort((a, b) => b.reputation - a.reputation);
  }

  async getCouncilInsights(projectId: string): Promise<CouncilInsights> {
    const members = await this.getCouncilMembers(projectId);

    const topContributors = [...members]
      .sort((a, b) => {
        const scoreA = a.proposalCount * 2 + a.acceptedCount;
        const scoreB = b.proposalCount * 2 + b.acceptedCount;
        return scoreB - scoreA;
      })
      .slice(0, 5);

    const mostTrusted = [...members]
      .filter((m) => m.status === "active")
      .sort((a, b) => {
        const trustA = a.reputation + a.acceptedCount * 0.5 - a.rejectedCount * 0.3;
        const trustB = b.reputation + b.acceptedCount * 0.5 - b.rejectedCount * 0.3;
        return trustB - trustA;
      })
      .slice(0, 5);

    const cutoff = Date.now() - INACTIVE_DAYS * 24 * 60 * 60 * 1000;
    const requiringReview = members.filter((m) => {
      const lowReputation = m.reputation < LOW_REPUTATION_THRESHOLD;
      const highRejections =
        m.rejectedCount > m.acceptedCount && m.rejectedCount >= 2;
      const inactive =
        m.lastActivity != null
          ? m.lastActivity.getTime() < cutoff
          : m.proposalCount === 0;
      return lowReputation || highRejections || inactive;
    });

    return {
      members,
      topContributors,
      mostTrusted,
      requiringReview,
    };
  }

  findBestByRole(members: AgentCouncilMember[], roleKeyword: string): AgentCouncilMember | null {
    const matches = members.filter((m) => m.role.includes(roleKeyword));
    if (matches.length === 0) return null;
    return matches.sort((a, b) => b.influenceScore - a.influenceScore)[0] ?? null;
  }
}

export const agentCouncilService = new AgentCouncilService();
