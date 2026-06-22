import { prisma } from "@/server/db/prisma";
import { workforceFieldsForAgent } from "./workforce-seed";
import { projectAssignmentService } from "./project-assignment.service";
import type { DefaultAgentConfig } from "@/server/agents/default-agents";

export async function backfillWorkforceForProject(projectId: string) {
  const agents = await prisma.agent.findMany({ where: { projectId } });
  if (agents.length === 0) return;

  const alex = agents.find((a) => a.role === "product_manager");

  for (const agent of agents) {
    const defaults = workforceFieldsForAgent({
      name: agent.name,
      role: agent.role as DefaultAgentConfig["role"],
      expertise: agent.expertise,
      systemPrompt: agent.systemPrompt,
      votingWeight: agent.votingWeight,
      isActive: agent.isActive,
    });

    await prisma.agent.update({
      where: { id: agent.id },
      data: {
        title: agent.title ?? defaults.title,
        department: agent.department ?? defaults.department,
        rank: agent.rank ?? defaults.rank,
        avatarType: agent.avatarType ?? defaults.avatarType,
        avatarSeed: agent.avatarSeed ?? defaults.avatarSeed,
        managerAgentId:
          agent.managerAgentId ??
          (agent.role !== "product_manager" && alex ? alex.id : null),
      },
    });

    const existingAssignment = await prisma.projectAssignment.findUnique({
      where: { projectId_agentId: { projectId, agentId: agent.id } },
    });
    if (!existingAssignment) {
      await projectAssignmentService.assign({
        projectId,
        agentId: agent.id,
        role: agent.title ?? defaults.title,
        allocationPercent: 100,
        isLead: (agent.rank ?? defaults.rank) === "LEAD" || (agent.rank ?? defaults.rank) === "DIRECTOR",
        assignedBy: "backfill",
      });
    }
  }
}
