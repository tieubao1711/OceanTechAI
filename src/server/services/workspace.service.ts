import { prisma } from "@/server/db/prisma";
import { governanceService } from "@/server/governance/governance.service";
import { memoryService } from "@/server/memory/memory.service";

export class WorkspaceService {
  async list() {
    return prisma.workspace.findMany({
      include: { projects: true, owner: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async create(params: { name: string; description?: string; ownerId: string }) {
    const workspace = await prisma.workspace.create({
      data: {
        name: params.name,
        description: params.description,
        ownerId: params.ownerId,
      },
    });

    await governanceService.seedWorkspaceRules(workspace.id);
    await memoryService.upsertEntry({
      scope: "WORKSPACE",
      workspaceId: workspace.id,
      key: "culture",
      value: params.description ?? "Default workspace — Founder-led AI organization.",
      source: "workspace_create",
    });

    return workspace;
  }
}

export const workspaceService = new WorkspaceService();
