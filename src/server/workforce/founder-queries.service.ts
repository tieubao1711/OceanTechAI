import { prisma } from "@/server/db/prisma";
import { projectAssignmentService } from "./project-assignment.service";
import { workforceService } from "./workforce.service";
import { DEPARTMENT_LABELS } from "./workforce-types";

export class FounderQueriesService {
  async whoOwnsProject(projectId: string) {
    const lead = await projectAssignmentService.findProjectLead(projectId);
    const project = await prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      select: { name: true },
    });
    return {
      projectName: project.name,
      lead: lead?.agentName ?? null,
      role: lead?.role ?? null,
      allocation: lead?.allocationPercent ?? null,
    };
  }

  async whoIsLeadArchitect(workspaceId: string) {
    const agent = await prisma.agent.findFirst({
      where: {
        project: { workspaceId },
        OR: [
          { title: { contains: "Architect", mode: "insensitive" } },
          { role: "system_architect" },
        ],
        workforceStatus: "ACTIVE",
      },
      orderBy: { rank: "desc" },
    });
    return agent
      ? { name: agent.name, title: agent.title, department: agent.department }
      : null;
  }

  async whoIsOverloaded(workspaceId: string) {
    const over = await projectAssignmentService.getOverallocatedAgents(workspaceId);
    const agents = await prisma.agent.findMany({
      where: { id: { in: over.map((o) => o.agentId) } },
      select: { id: true, name: true, title: true },
    });
    const byId = new Map(agents.map((a) => [a.id, a]));
    return over.map((o) => ({
      name: byId.get(o.agentId)?.name ?? o.agentId,
      title: byId.get(o.agentId)?.title,
      allocationTotal: o.allocationTotal,
    }));
  }

  async whoContributesMost(projectId: string, limit = 5) {
    const agents = await prisma.agent.findMany({
      where: { projectId, workforceStatus: "ACTIVE" },
      orderBy: [{ acceptedCount: "desc" }, { proposalCount: "desc" }],
      take: limit,
      select: { name: true, acceptedCount: true, proposalCount: true, reputationScore: true },
    });
    return agents;
  }

  async whoIsInactive(projectId: string, inactiveDays = 30) {
    const cutoff = Date.now() - inactiveDays * 24 * 60 * 60 * 1000;
    const agents = await prisma.agent.findMany({
      where: { projectId, workforceStatus: "ACTIVE" },
      include: {
        messages: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
      },
    });
    return agents
      .filter((a) => {
        const last = a.messages[0]?.createdAt;
        return !last || last.getTime() < cutoff;
      })
      .map((a) => ({ name: a.name, title: a.title, proposalCount: a.proposalCount }));
  }

  async whoShouldBePromoted(projectId: string) {
    return workforceService.getPromotionCandidates(projectId);
  }

  async whoWorksOnMultipleProjects(workspaceId: string) {
    const assignments = await prisma.projectAssignment.groupBy({
      by: ["agentId"],
      where: { project: { workspaceId } },
      _count: { projectId: true },
      having: { projectId: { _count: { gt: 1 } } },
    });
    const agentIds = assignments.map((a) => a.agentId);
    const agents = await prisma.agent.findMany({
      where: { id: { in: agentIds } },
      select: { id: true, name: true, title: true },
    });
    const projectLists = await Promise.all(
      agentIds.map(async (id) => ({
        agentId: id,
        projects: await projectAssignmentService.listByAgent(id),
      }))
    );
    const byId = new Map(agents.map((a) => [a.id, a]));
    return projectLists.map((p) => ({
      name: byId.get(p.agentId)?.name,
      title: byId.get(p.agentId)?.title,
      projects: p.projects.map((a) => `${a.projectName} (${a.allocationPercent}%)`),
    }));
  }

  async bestPerformingDepartment(workspaceId: string) {
    const agents = await prisma.agent.findMany({
      where: { project: { workspaceId }, workforceStatus: "ACTIVE" },
      select: { department: true, reputationScore: true, acceptedCount: true },
    });
    const byDept = new Map<string, { total: number; count: number; accepted: number }>();
    for (const a of agents) {
      const cur = byDept.get(a.department) ?? { total: 0, count: 0, accepted: 0 };
      cur.total += a.reputationScore;
      cur.count += 1;
      cur.accepted += a.acceptedCount;
      byDept.set(a.department, cur);
    }
    const ranked = [...byDept.entries()]
      .map(([department, stats]) => ({
        department,
        label: DEPARTMENT_LABELS[department as keyof typeof DEPARTMENT_LABELS],
        avgReputation: stats.total / stats.count,
        totalAccepted: stats.accepted,
      }))
      .sort((a, b) => b.avgReputation - a.avgReputation || b.totalAccepted - a.totalAccepted);
    return ranked[0] ?? null;
  }
}

export const founderQueriesService = new FounderQueriesService();
