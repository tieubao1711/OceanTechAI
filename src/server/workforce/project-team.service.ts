import { prisma } from "@/server/db/prisma";
import { agentIdentityService } from "@/server/agents/agent-identity.service";
import { agentAvatarService } from "./agent-avatar.service";
import { assignmentHistoryService } from "./assignment-history.service";
import { projectAssignmentService } from "./project-assignment.service";
import { teamRecommendationService } from "./team-recommendation.service";
import { DEPARTMENT_LABELS, type ProjectTeamMemberView, type ProjectTeamPageData } from "./workforce-types";
export class ProjectTeamService {
  async getTeamPage(projectId: string): Promise<ProjectTeamPageData> {
    const project = await prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      select: { id: true, name: true, description: true, workspaceId: true },
    });

    const assignments = await prisma.projectAssignment.findMany({
      where: { projectId },
      include: {
        agent: true,
      },
      orderBy: [{ isLead: "desc" }, { allocationPercent: "desc" }],
    });

    const members: ProjectTeamMemberView[] = [];
    for (const row of assignments) {
      const [member, capacity] = await Promise.all([
        agentIdentityService.buildCouncilMember(row.agent, projectId),
        projectAssignmentService.getAgentCapacity(row.agent.id),
      ]);
      const avatar = agentAvatarService.resolve(
        row.agent.avatarSeed ?? row.agent.name,
        row.agent.avatarType
      );
      members.push({
        assignmentId: row.id,
        agentId: row.agent.id,
        homeProjectId: row.agent.projectId,
        agentName: row.agent.name,
        title: row.agent.title ?? member.title,
        department: row.agent.department,
        departmentLabel: DEPARTMENT_LABELS[row.agent.department],
        projectRole: row.role,
        allocationPercent: row.allocationPercent,
        isLead: row.isLead,
        status: member.status,
        reputation: member.reputation,
        influenceScore: member.influenceScore,
        avatarEmoji: avatar.emoji,
        avatarColor: avatar.color,
        isOverallocated: capacity.isOverallocated,
      });
    }

    const teamHealth = teamRecommendationService.analyzeTeam({
      projectName: project.name,
      projectDescription: project.description,
      members,
    });

    const warnings: string[] = [...teamHealth.messages];
    if (!members.some((m) => m.isLead)) warnings.unshift("No project lead assigned");

    const assignedIds = new Set(members.map((m) => m.agentId));
    const availableAgents = await prisma.agent.findMany({
      where: {
        project: { workspaceId: project.workspaceId },
        workforceStatus: "ACTIVE",
        isActive: true,
        id: { notIn: Array.from(assignedIds) },
      },
      select: { id: true, name: true, title: true, department: true },
      orderBy: { name: "asc" },
    });

    const recentEvents = await assignmentHistoryService.listByProject(projectId);

    return {
      projectId: project.id,
      projectName: project.name,
      members,
      warnings,
      teamHealth,
      recentEvents,
      availableAgents: availableAgents.map((a) => ({
        id: a.id,
        name: a.name,
        title: a.title,
        department: DEPARTMENT_LABELS[a.department],
      })),
    };
  }

  async addAgentToProject(params: {
    projectId: string;
    agentId: string;
    role: string;
    allocationPercent: number;
    isLead?: boolean;
  }) {
    const agent = await prisma.agent.findUniqueOrThrow({ where: { id: params.agentId } });
    await projectAssignmentService.assign({
      ...params,
      assignedBy: "founder",
    });
    await assignmentHistoryService.record({
      projectId: params.projectId,
      agentId: params.agentId,
      type: "ASSIGNED",
      message: `${agent.name} assigned as ${params.role} (${params.allocationPercent}%)`,
    });
  }

  async removeFromProject(projectId: string, agentId: string) {
    const assignment = await prisma.projectAssignment.findUnique({
      where: { projectId_agentId: { projectId, agentId } },
      include: { agent: { select: { name: true } } },
    });
    if (!assignment) return;

    await prisma.projectAssignment.delete({
      where: { projectId_agentId: { projectId, agentId } },
    });
    await assignmentHistoryService.record({
      projectId,
      agentId,
      type: "REMOVED",
      message: `${assignment.agent.name} removed from project (assignment only — agent retained)`,
    });
  }

  async setLead(projectId: string, agentId: string) {
    await prisma.projectAssignment.updateMany({
      where: { projectId },
      data: { isLead: false },
    });
    await prisma.projectAssignment.update({
      where: { projectId_agentId: { projectId, agentId } },
      data: { isLead: true },
    });
    const agent = await prisma.agent.findUniqueOrThrow({ where: { id: agentId } });
    await assignmentHistoryService.record({
      projectId,
      agentId,
      type: "LEAD_CHANGED",
      message: `${agent.name} set as project lead`,
    });
  }

  async updateAssignment(params: {
    projectId: string;
    agentId: string;
    role?: string;
    allocationPercent?: number;
  }) {
    const existing = await prisma.projectAssignment.findUniqueOrThrow({
      where: { projectId_agentId: { projectId: params.projectId, agentId: params.agentId } },
      include: { agent: { select: { name: true } } },
    });

    if (params.allocationPercent != null) {
      const others = await prisma.projectAssignment.findMany({
        where: { agentId: params.agentId, projectId: { not: params.projectId } },
      });
      const otherTotal = others.reduce((s, a) => s + a.allocationPercent, 0);
      const { capacityManagementService } = await import("./capacity-management.service");
      const validation = capacityManagementService.validateAllocation(
        otherTotal,
        params.allocationPercent
      );
      if (!validation.valid) throw new Error(validation.message ?? "Invalid allocation");
    }

    const updated = await prisma.projectAssignment.update({
      where: { projectId_agentId: { projectId: params.projectId, agentId: params.agentId } },
      data: {
        ...(params.role != null ? { role: params.role } : {}),
        ...(params.allocationPercent != null ? { allocationPercent: params.allocationPercent } : {}),
      },
    });

    if (params.role != null && params.role !== existing.role) {
      await assignmentHistoryService.record({
        projectId: params.projectId,
        agentId: params.agentId,
        type: "ROLE_CHANGED",
        message: `${existing.agent.name} role changed to ${params.role}`,
      });
    }
    if (params.allocationPercent != null && params.allocationPercent !== existing.allocationPercent) {
      await assignmentHistoryService.record({
        projectId: params.projectId,
        agentId: params.agentId,
        type: "ALLOCATION_CHANGED",
        message: `${existing.agent.name} allocation changed to ${params.allocationPercent}%`,
      });
    }

    return updated;
  }
}

export const projectTeamService = new ProjectTeamService();
