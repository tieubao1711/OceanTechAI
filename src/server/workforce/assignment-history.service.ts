import { prisma } from "@/server/db/prisma";
import type { AssignmentEventView } from "./workforce-types";

export type AssignmentEventType =
  | "ASSIGNED"
  | "REMOVED"
  | "ROLE_CHANGED"
  | "ALLOCATION_CHANGED"
  | "LEAD_CHANGED";

export class AssignmentHistoryService {
  async record(params: {
    projectId: string;
    agentId: string;
    type: AssignmentEventType;
    message: string;
  }) {
    return prisma.projectAssignmentEvent.create({
      data: {
        projectId: params.projectId,
        agentId: params.agentId,
        type: params.type,
        message: params.message,
      },
    });
  }

  async listByProject(projectId: string, limit = 15): Promise<AssignmentEventView[]> {
    const rows = await prisma.projectAssignmentEvent.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return rows.map((r) => ({
      id: r.id,
      agentId: r.agentId,
      type: r.type,
      message: r.message,
      createdAt: r.createdAt,
    }));
  }
}

export const assignmentHistoryService = new AssignmentHistoryService();
