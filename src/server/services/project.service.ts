import { prisma } from "@/server/db/prisma";
import { resolveProjectRoster } from "@/server/agents/project-roster";
import { memoryService } from "@/server/memory/memory.service";
import { timelineService, TIMELINE_EVENT_TYPES } from "@/server/insights/timeline.service";
import { adrService } from "@/server/insights/adr.service";
import { workforceFieldsForAgent } from "@/server/workforce/workforce-seed";
import { projectAssignmentService } from "@/server/workforce/project-assignment.service";

export class ProjectService {
  async getById(projectId: string) {
    return prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      include: {
        workspace: true,
        agents: { orderBy: { createdAt: "asc" } },
        discussions: {
          orderBy: { createdAt: "desc" },
          take: 10,
          include: { proposal: true },
        },
      },
    });
  }

  async create(params: {
    name: string;
    description?: string;
    workspaceId: string;
    seedAgents?: boolean;
  }) {
    const project = await prisma.project.create({
      data: {
        name: params.name,
        description: params.description,
        workspaceId: params.workspaceId,
      },
    });

    await memoryService.upsertEntry({
      scope: "PROJECT",
      projectId: project.id,
      key: "tech_stack",
      value: "Next.js, TypeScript, PostgreSQL, Prisma",
      source: "project_create",
    });

    if (params.seedAgents !== false) {
      await this.seedDefaultAgents(project.id);
    }

    await adrService.seedForProject(project.id);
    await timelineService.recordEvent({
      projectId: project.id,
      title: `${project.name} Created`,
      description: "Project initialized in OceanTechAI Workspace.",
      eventType: TIMELINE_EVENT_TYPES.PROJECT_CREATED,
      occurredAt: project.createdAt,
    });

    return project;
  }

  /**
   * Đồng bộ roster theo loại dự án — upsert theo stableId hoặc role, không clone trùng tên.
   */
  async seedDefaultAgents(projectId: string) {
    const project = await prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      select: { id: true, name: true },
    });
    const roster = resolveProjectRoster(projectId, project.name);
    const rosterRoles = new Set(roster.map((r) => r.role));
    const createdOrUpdated = [];

    for (const config of roster) {
      const workforce = workforceFieldsForAgent(config);
      const data = {
        projectId,
        name: config.name,
        role: config.role,
        expertise: config.expertise,
        systemPrompt: config.systemPrompt,
        votingWeight: config.votingWeight,
        isActive: config.isActive,
        modelProvider: "mock",
        modelName: "mock-v1",
        toolsAllowed: [] as string[],
        department: workforce.department,
        title: workforce.title,
        rank: workforce.rank,
        avatarType: workforce.avatarType,
        avatarSeed: workforce.avatarSeed,
        workforceStatus: config.isActive ? ("ACTIVE" as const) : ("ACTIVE" as const),
      };

      let agent =
        config.stableId != null
          ? await prisma.agent.findUnique({ where: { id: config.stableId } })
          : null;

      if (!agent) {
        agent = await prisma.agent.findFirst({
          where: { projectId, role: config.role },
        });
      }

      if (agent) {
        agent = await prisma.agent.update({
          where: { id: agent.id },
          data,
        });
      } else {
        agent = await prisma.agent.create({
          data: {
            ...(config.stableId ? { id: config.stableId } : {}),
            ...data,
          },
        });
      }

      createdOrUpdated.push(agent);
    }

    const pm = createdOrUpdated.find((a) => a.role === "product_manager");
    for (const agent of createdOrUpdated) {
      if (agent.role !== "product_manager" && pm) {
        await prisma.agent.update({
          where: { id: agent.id },
          data: { managerAgentId: pm.id },
        });
      }

      const existingAssignment = await prisma.projectAssignment.findUnique({
        where: { projectId_agentId: { projectId, agentId: agent.id } },
      });
      if (!existingAssignment) {
        await projectAssignmentService.assign({
          projectId,
          agentId: agent.id,
          role: agent.title ?? agent.role,
          allocationPercent: 100,
          isLead: agent.rank === "LEAD" || agent.rank === "DIRECTOR",
          assignedBy: "seed",
        });
      }
    }

    // Gỡ agent cũ trùng template (vd. Alex trên MMO sau khi chuyển sang Linh)
    const staleAgents = await prisma.agent.findMany({
      where: {
        projectId,
        role: { notIn: Array.from(rosterRoles) },
      },
    });
    for (const stale of staleAgents) {
      const hasHistory =
        (await prisma.agentMessage.count({ where: { agentId: stale.id } })) > 0 ||
        (await prisma.agentConversation.count({ where: { agentId: stale.id } })) > 0;
      if (!hasHistory) {
        await prisma.projectAssignment.deleteMany({ where: { agentId: stale.id, projectId } });
        await prisma.agent.delete({ where: { id: stale.id } });
      } else {
        await prisma.agent.update({
          where: { id: stale.id },
          data: { workforceStatus: "RETIRED", isActive: false },
        });
      }
    }
  }
}

export const projectService = new ProjectService();
