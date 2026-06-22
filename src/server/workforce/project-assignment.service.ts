import { prisma } from "@/server/db/prisma";
import { capacityManagementService } from "./capacity-management.service";
import type { AgentCapacity, ProjectAssignmentView, ProjectTeamView } from "./workforce-types";

export class ProjectAssignmentService {
  async listByAgent(agentId: string): Promise<ProjectAssignmentView[]> {
    const rows = await prisma.projectAssignment.findMany({
      where: { agentId },
      include: { project: { select: { name: true } }, agent: { select: { name: true } } },
      orderBy: { allocationPercent: "desc" },
    });
    return rows.map((r) => this.toView(r));
  }

  async listByProject(projectId: string): Promise<ProjectAssignmentView[]> {
    const rows = await prisma.projectAssignment.findMany({
      where: { projectId },
      include: { project: { select: { name: true } }, agent: { select: { name: true } } },
      orderBy: [{ isLead: "desc" }, { allocationPercent: "desc" }],
    });
    return rows.map((r) => this.toView(r));
  }

  async getProjectTeam(projectId: string): Promise<ProjectTeamView> {
    const project = await prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      select: { id: true, name: true },
    });
    const assignments = await this.listByProject(projectId);
    return {
      projectId: project.id,
      projectName: project.name,
      leads: assignments.filter((a) => a.isLead),
      members: assignments.filter((a) => !a.isLead),
    };
  }

  async assign(params: {
    projectId: string;
    agentId: string;
    role: string;
    allocationPercent: number;
    isLead?: boolean;
    assignedBy?: string;
  }) {
    const existing = await prisma.projectAssignment.findMany({
      where: { agentId: params.agentId },
    });
    const otherTotal = existing
      .filter((a) => a.projectId !== params.projectId)
      .reduce((s, a) => s + a.allocationPercent, 0);
    const validation = capacityManagementService.validateAllocation(
      otherTotal,
      params.allocationPercent
    );
    if (!validation.valid) {
      throw new Error(validation.message ?? "Invalid allocation");
    }

    return prisma.projectAssignment.upsert({
      where: {
        projectId_agentId: { projectId: params.projectId, agentId: params.agentId },
      },
      create: {
        projectId: params.projectId,
        agentId: params.agentId,
        role: params.role,
        allocationPercent: params.allocationPercent,
        isLead: params.isLead ?? false,
        assignedBy: params.assignedBy ?? "founder",
      },
      update: {
        role: params.role,
        allocationPercent: params.allocationPercent,
        isLead: params.isLead ?? false,
        assignedBy: params.assignedBy ?? "founder",
      },
    });
  }

  async getAgentCapacity(agentId: string): Promise<AgentCapacity> {
    const assignments = await prisma.projectAssignment.findMany({
      where: { agentId },
      select: { allocationPercent: true },
    });
    return capacityManagementService.buildCapacity(
      agentId,
      assignments.map((a) => a.allocationPercent)
    );
  }

  async getOverallocatedAgents(workspaceId: string): Promise<AgentCapacity[]> {
    const agents = await prisma.agent.findMany({
      where: { project: { workspaceId }, workforceStatus: "ACTIVE" },
      select: { id: true },
    });
    const capacities = await Promise.all(
      agents.map((a) => this.getAgentCapacity(a.id))
    );
    return capacities.filter((c) => c.isOverallocated);
  }

  async findProjectLead(projectId: string): Promise<ProjectAssignmentView | null> {
    const leads = await this.listByProject(projectId);
    return leads.find((a) => a.isLead) ?? leads[0] ?? null;
  }

  private toView(row: {
    id: string;
    projectId: string;
    agentId: string;
    role: string;
    allocationPercent: number;
    isLead: boolean;
    assignedAt: Date;
    assignedBy: string;
    project: { name: string };
    agent: { name: string };
  }): ProjectAssignmentView {
    return {
      id: row.id,
      projectId: row.projectId,
      projectName: row.project.name,
      agentId: row.agentId,
      agentName: row.agent.name,
      role: row.role,
      allocationPercent: row.allocationPercent,
      isLead: row.isLead,
      assignedAt: row.assignedAt,
      assignedBy: row.assignedBy,
    };
  }
}

export const projectAssignmentService = new ProjectAssignmentService();
