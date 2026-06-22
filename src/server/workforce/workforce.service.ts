import type { AgentRank, AvatarType, Department } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { agentInfluenceService } from "@/server/agents/agent-influence.service";
import { memoryService } from "@/server/memory/memory.service";
import { agentAvatarService, generateAvatarSeed } from "./agent-avatar.service";
import { nextRank, prevRank, workforceDefaultsForRole } from "./role-workforce-map";
import { projectAssignmentService } from "./project-assignment.service";
import type { PromotionCandidate } from "./workforce-types";
import { RANK_ORDER } from "./workforce-types";

const PROMOTION_REPUTATION_MIN = 70;
const PROMOTION_INFLUENCE_MIN = 60;
const PROMOTION_ACCEPTED_MIN = 3;

export class WorkforceService {
  async hireAgent(params: {
    projectId: string;
    name: string;
    department: Department;
    role: string;
    model: string;
    rank: AgentRank;
    title?: string;
    allocationPercent?: number;
    managerAgentId?: string | null;
    avatarType?: AvatarType;
    assignedBy?: string;
  }) {
    const defaults = workforceDefaultsForRole(params.role);
    const avatarSeed = generateAvatarSeed(params.name, params.role);
    const avatarType = params.avatarType ?? "CORPORATE";

    const agent = await prisma.agent.create({
      data: {
        projectId: params.projectId,
        name: params.name,
        role: params.role,
        expertise: [],
        systemPrompt: `You are ${params.name}, ${params.title ?? defaults.title} in ${params.department}.`,
        modelProvider: params.model.includes("/") ? params.model.split("/")[0]! : "mock",
        modelName: params.model.includes("/") ? params.model.split("/")[1]! : params.model,
        toolsAllowed: [],
        isActive: true,
        department: params.department,
        title: params.title ?? defaults.title,
        rank: params.rank,
        managerAgentId: params.managerAgentId ?? null,
        workforceStatus: "ACTIVE",
        avatarType,
        avatarSeed,
      },
    });

    await memoryService.upsertEntry({
      scope: "AGENT",
      agentRole: params.role,
      key: "hire_context",
      value: `${params.name} hired as ${params.title ?? defaults.title} (${params.department}).`,
      source: "hire",
    });

    const allocation = params.allocationPercent ?? 100;
    await projectAssignmentService.assign({
      projectId: params.projectId,
      agentId: agent.id,
      role: params.title ?? defaults.title,
      allocationPercent: allocation,
      isLead: params.rank === "LEAD" || params.rank === "DIRECTOR",
      assignedBy: params.assignedBy ?? "founder",
    });

    return agent;
  }

  async promote(agentId: string): Promise<{ from: AgentRank; to: AgentRank }> {
    const agent = await prisma.agent.findUniqueOrThrow({ where: { id: agentId } });
    const to = nextRank(agent.rank);
    if (!to) throw new Error("Agent is already at maximum rank.");
    await prisma.agent.update({
      where: { id: agentId },
      data: { rank: to },
    });
    return { from: agent.rank, to };
  }

  async demote(agentId: string): Promise<{ from: AgentRank; to: AgentRank }> {
    const agent = await prisma.agent.findUniqueOrThrow({ where: { id: agentId } });
    const to = prevRank(agent.rank);
    if (!to) throw new Error("Agent is already at minimum rank.");
    await prisma.agent.update({
      where: { id: agentId },
      data: { rank: to },
    });
    return { from: agent.rank, to };
  }

  async suspend(agentId: string) {
    return prisma.agent.update({
      where: { id: agentId },
      data: { workforceStatus: "SUSPENDED", isActive: false },
    });
  }

  async retire(agentId: string) {
    return prisma.agent.update({
      where: { id: agentId },
      data: { workforceStatus: "RETIRED", isActive: false },
    });
  }

  async reactivate(agentId: string) {
    return prisma.agent.update({
      where: { id: agentId },
      data: { workforceStatus: "ACTIVE", isActive: true },
    });
  }

  async getPromotionCandidates(projectId: string): Promise<PromotionCandidate[]> {
    const agents = await prisma.agent.findMany({
      where: {
        projectId,
        workforceStatus: "ACTIVE",
        rank: { not: "DIRECTOR" },
      },
    });

    const candidates: PromotionCandidate[] = [];
    for (const agent of agents) {
      const suggested = nextRank(agent.rank);
      if (!suggested) continue;

      const reputation = Math.round(agent.reputationScore * 10);
      const acceptedCount = agent.acceptedCount;
      const influenceScore = agentInfluenceService.calculateScore({
        acceptedCount: agent.acceptedCount,
        rejectedCount: agent.rejectedCount,
        proposalCount: agent.proposalCount,
        reputationScore: agent.reputationScore,
      });

      if (
        reputation >= PROMOTION_REPUTATION_MIN &&
        influenceScore >= PROMOTION_INFLUENCE_MIN &&
        acceptedCount >= PROMOTION_ACCEPTED_MIN
      ) {
        candidates.push({
          agentId: agent.id,
          name: agent.name,
          currentRank: agent.rank,
          suggestedRank: suggested,
          reputation,
          influenceScore,
          acceptedCount,
          reason: `Reputation ${reputation}, influence ${influenceScore}, ${acceptedCount} accepted decisions`,
        });
      }
    }

    return candidates.sort(
      (a, b) =>
        b.influenceScore - a.influenceScore ||
        RANK_ORDER[b.currentRank] - RANK_ORDER[a.currentRank]
    );
  }

  resolveAvatar(agent: { avatarSeed: string; avatarType: AvatarType }) {
    return agentAvatarService.resolve(agent.avatarSeed, agent.avatarType);
  }
}

export const workforceService = new WorkforceService();
