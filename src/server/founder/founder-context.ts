import { prisma } from "@/server/db/prisma";
import { DOGFOOD_PROJECT_ID, DOGFOOD_WORKSPACE_ID } from "@/lib/dogfood-ids";

export type FounderScope = {
  workspaceIds: string[];
  projectIds: string[];
  primaryProjectId: string;
  primaryWorkspaceId: string;
};

export async function getFounderScope(): Promise<FounderScope> {
  const user = await prisma.user.findFirst({ orderBy: { createdAt: "asc" } });

  const workspaces = await prisma.workspace.findMany({
    where: user ? { ownerId: user.id } : undefined,
    include: { projects: { select: { id: true } } },
    orderBy: { createdAt: "asc" },
  });

  const workspaceIds = workspaces.map((w) => w.id);
  const projectIds = workspaces.flatMap((w) => w.projects.map((p) => p.id));

  const primaryWorkspaceId =
    workspaceIds.includes(DOGFOOD_WORKSPACE_ID)
      ? DOGFOOD_WORKSPACE_ID
      : workspaceIds[0] ?? "";

  const primaryProjectId =
    projectIds.includes(DOGFOOD_PROJECT_ID)
      ? DOGFOOD_PROJECT_ID
      : projectIds[0] ?? "";

  return { workspaceIds, projectIds, primaryProjectId, primaryWorkspaceId };
}
