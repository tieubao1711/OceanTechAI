import { prisma } from "@/server/db/prisma";
import type { Department } from "@prisma/client";
import { projectAssignmentService } from "./project-assignment.service";
import { workforceService } from "./workforce.service";
import type { CompanyOverview } from "./workforce-types";

export class CompanyOverviewService {
  async getOverview(workspaceId: string): Promise<CompanyOverview> {
    const agents = await prisma.agent.findMany({
      where: { project: { workspaceId } },
      select: {
        id: true,
        workforceStatus: true,
        department: true,
        reputationScore: true,
      },
    });

    const projects = await prisma.project.count({ where: { workspaceId } });
    const assignments = await prisma.projectAssignment.count({
      where: { project: { workspaceId } },
    });

    const deptCounts = new Map<Department, number>();
    for (const a of agents) {
      deptCounts.set(a.department, (deptCounts.get(a.department) ?? 0) + 1);
    }

    const activeAgents = agents.filter((a) => a.workforceStatus === "ACTIVE");
    const reputations = activeAgents.map((a) => a.reputationScore);
    const averageReputation =
      reputations.length > 0
        ? Math.round(reputations.reduce((s, r) => s + r, 0) / reputations.length)
        : 0;

    const capacities = await Promise.all(
      activeAgents.map((a) => projectAssignmentService.getAgentCapacity(a.id))
    );
    const utilizationRate =
      capacities.length > 0
        ? Math.round(
            capacities.reduce((s, c) => s + c.allocationTotal, 0) / capacities.length
          )
        : 0;

    const overallocated = capacities.filter((c) => c.isOverallocated);
    const projectIds = (
      await prisma.project.findMany({ where: { workspaceId }, select: { id: true } })
    ).map((p) => p.id);
    const promotionLists = await Promise.all(
      projectIds.map((id) => workforceService.getPromotionCandidates(id))
    );
    const promotionCandidates = promotionLists.flat();

    return {
      totalAgents: agents.length,
      activeAgents: activeAgents.length,
      retiredAgents: agents.filter((a) => a.workforceStatus === "RETIRED").length,
      suspendedAgents: agents.filter((a) => a.workforceStatus === "SUSPENDED").length,
      departments: Array.from(deptCounts.entries()).map(([department, count]) => ({
        department,
        count,
      })),
      projects,
      assignments,
      averageReputation,
      utilizationRate,
      overallocatedAgents: overallocated.length,
      promotionCandidates: promotionCandidates.length,
    };
  }
}

export const companyOverviewService = new CompanyOverviewService();
