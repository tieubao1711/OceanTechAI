import { prisma } from "@/server/db/prisma";
import type { Department } from "@prisma/client";
import { agentAvatarService } from "./agent-avatar.service";
import { DEPARTMENT_LABELS, type OrganizationChart } from "./workforce-types";

const DEPARTMENT_ORDER: Department[] = [
  "PRODUCT",
  "ENGINEERING",
  "QA",
  "SECURITY",
  "OPERATIONS",
  "RESEARCH",
];

export class OrganizationChartService {
  async getChart(workspaceId: string): Promise<OrganizationChart> {
    const agents = await prisma.agent.findMany({
      where: { project: { workspaceId }, workforceStatus: { not: "RETIRED" } },
      include: {
        manager: { select: { name: true } },
        project: { select: { name: true } },
      },
      orderBy: [{ department: "asc" }, { rank: "desc" }, { name: "asc" }],
    });

    const byDept = new Map<Department, typeof agents>();
    for (const dept of DEPARTMENT_ORDER) {
      byDept.set(dept, []);
    }
    for (const agent of agents) {
      const list = byDept.get(agent.department) ?? [];
      list.push(agent);
      byDept.set(agent.department, list);
    }

    return {
      founderLabel: "Founder",
      departments: DEPARTMENT_ORDER.map((department) => ({
        department,
        label: DEPARTMENT_LABELS[department],
        agents: (byDept.get(department) ?? []).map((a) => {
          const avatar = agentAvatarService.resolve(a.avatarSeed, a.avatarType);
          return {
            id: a.id,
            name: a.name,
            role: a.role,
            department: a.department,
            title: a.title,
            rank: a.rank,
            managerAgentId: a.managerAgentId,
            managerName: a.manager?.name ?? null,
            workforceStatus: a.workforceStatus,
            avatarEmoji: avatar.emoji,
            avatarColor: avatar.color,
          };
        }),
      })),
    };
  }

  async getManagerChain(agentId: string): Promise<string[]> {
    const chain: string[] = [];
    let currentId: string | null = agentId;
    const seen = new Set<string>();
    while (currentId && !seen.has(currentId)) {
      seen.add(currentId);
      const agent = await prisma.agent.findUnique({
        where: { id: currentId },
        select: { managerAgentId: true, name: true },
      });
      if (!agent?.managerAgentId) break;
      const manager = await prisma.agent.findUnique({
        where: { id: agent.managerAgentId },
        select: { id: true, name: true, managerAgentId: true },
      });
      if (!manager) break;
      chain.push(manager.name);
      currentId = manager.id;
    }
    return chain;
  }
}

export const organizationChartService = new OrganizationChartService();
