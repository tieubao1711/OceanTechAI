import type { Department } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { roleToDepartment } from "./role-workforce-map";

const TOPIC_DEPARTMENTS: Record<string, Department[]> = {
  economy: ["PRODUCT", "RESEARCH", "QA"],
  security: ["SECURITY", "ENGINEERING"],
  architecture: ["ENGINEERING", "PRODUCT"],
  qa: ["QA", "ENGINEERING"],
  operations: ["OPERATIONS", "ENGINEERING"],
  product: ["PRODUCT", "RESEARCH"],
  default: ["PRODUCT", "ENGINEERING", "QA"],
};

export class DebateParticipantService {
  resolveDepartmentsForTopic(topic: string): Department[] {
    const lower = topic.toLowerCase();
    for (const [key, depts] of Object.entries(TOPIC_DEPARTMENTS)) {
      if (key !== "default" && lower.includes(key)) return depts;
    }
    return TOPIC_DEPARTMENTS.default!;
  }

  async getParticipantsForDebate(params: {
    projectId: string;
    topic: string;
    includeAllActive?: boolean;
  }) {
    if (params.includeAllActive) {
      return prisma.agent.findMany({
        where: {
          projectId: params.projectId,
          isActive: true,
          workforceStatus: "ACTIVE",
        },
      });
    }

    const departments = this.resolveDepartmentsForTopic(params.topic);

    const assignedAgentIds = await prisma.projectAssignment.findMany({
      where: { projectId: params.projectId },
      select: { agentId: true },
    });
    const assignedIds = new Set(assignedAgentIds.map((a) => a.agentId));

    const agents = await prisma.agent.findMany({
      where: {
        isActive: true,
        workforceStatus: "ACTIVE",
        OR: [
          { id: { in: Array.from(assignedIds) } },
          { department: { in: departments }, projectId: params.projectId },
        ],
      },
    });

    const seen = new Set<string>();
    return agents.filter((a) => {
      if (seen.has(a.id)) return false;
      seen.add(a.id);
      const inTeam = assignedIds.has(a.id);
      const inDept = departments.includes(a.department);
      return inTeam || inDept;
    });
  }

  departmentForRole(role: string): Department {
    return roleToDepartment(role);
  }
}

export const debateParticipantService = new DebateParticipantService();
