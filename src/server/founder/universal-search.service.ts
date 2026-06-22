import { prisma } from "@/server/db/prisma";
import { getFounderScope } from "./founder-context";
import type { SearchResultItem } from "./founder-types";
import { founderService } from "./founder.service";

export class UniversalSearchService {
  async search(query: string, limit = 30): Promise<SearchResultItem[]> {
    const q = query.trim();
    if (!q) return [];

    const scope = await getFounderScope();
    const results: SearchResultItem[] = [];
    const lower = q.toLowerCase();

    const agents = await founderService.getGlobalAgents(q);
    for (const a of agents.slice(0, 8)) {
      results.push({
        type: "agent",
        id: a.id,
        title: a.name,
        subtitle: `${a.title} · ${a.departmentLabel}`,
        href: a.profileHref,
      });
    }

    const projects = await prisma.project.findMany({
      where: {
        id: { in: scope.projectIds },
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 5,
    });
    for (const p of projects) {
      results.push({
        type: "project",
        id: p.id,
        title: p.name,
        subtitle: p.description?.slice(0, 80) ?? "Project",
        href: `/projects/${p.id}`,
      });
    }

    const discussions = await prisma.discussion.findMany({
      where: {
        projectId: { in: scope.projectIds },
        userPrompt: { contains: q, mode: "insensitive" },
      },
      include: { project: { select: { name: true } } },
      take: 8,
      orderBy: { createdAt: "desc" },
    });
    for (const d of discussions) {
      results.push({
        type: "discussion",
        id: d.id,
        title: d.userPrompt.slice(0, 100),
        subtitle: `${d.project.name} · ${d.status}`,
        href: `/projects/${d.projectId}/discussions/${d.id}`,
        projectName: d.project.name,
      });
    }

    const proposals = await prisma.proposal.findMany({
      where: {
        discussion: { projectId: { in: scope.projectIds } },
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { summary: { contains: q, mode: "insensitive" } },
        ],
      },
      include: {
        discussion: { include: { project: { select: { id: true, name: true } } } },
      },
      take: 8,
      orderBy: { createdAt: "desc" },
    });
    for (const p of proposals) {
      const proj = p.discussion.project;
      results.push({
        type: "proposal",
        id: p.id,
        title: p.title,
        subtitle: `${proj.name} · ${p.status}`,
        href: `/projects/${proj.id}/proposals/${p.id}`,
        projectName: proj.name,
      });
    }

    const adrs = await prisma.adr.findMany({
      where: {
        projectId: { in: scope.projectIds },
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { summary: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 5,
    });
    const adrProjects = await prisma.project.findMany({
      where: { id: { in: adrs.map((a) => a.projectId) } },
      select: { id: true, name: true },
    });
    const adrProjectById = new Map(adrProjects.map((p) => [p.id, p.name]));
    for (const a of adrs) {
      const projectName = adrProjectById.get(a.projectId) ?? a.projectId;
      results.push({
        type: "adr",
        id: a.id,
        title: a.title,
        subtitle: `${projectName} · ADR-${a.number}`,
        href: `/projects/${a.projectId}/executive`,
        projectName,
      });
    }

    const memories = await prisma.memoryEntry.findMany({
      where: {
        OR: [
          { projectId: { in: scope.projectIds } },
          { workspaceId: { in: scope.workspaceIds } },
          { scope: "GLOBAL" },
        ],
        value: { contains: q, mode: "insensitive" },
      },
      take: 5,
    });
    for (const m of memories) {
      results.push({
        type: "learning",
        id: m.id,
        title: m.key,
        subtitle: m.value.slice(0, 100),
        href: m.projectId ? `/projects/${m.projectId}/executive` : "/learning",
        projectName: m.projectId ?? undefined,
      });
    }

    const cycles = await prisma.improvementCycle.findMany({
      where: {
        projectId: { in: scope.projectIds },
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { topicKey: { contains: q, mode: "insensitive" } },
        ],
      },
      include: { project: { select: { name: true } } },
      take: 5,
    });
    for (const c of cycles) {
      results.push({
        type: "learning",
        id: c.id,
        title: c.title,
        subtitle: `${c.project.name} · ${c.status}`,
        href: "/learning",
        projectName: c.project.name,
      });
    }

    const deduped = results.filter((item, idx, arr) => {
      const key = `${item.type}:${item.id}`;
      return arr.findIndex((x) => `${x.type}:${x.id}` === key) === idx;
    });

    return deduped
      .sort((a, b) => {
        const aExact = a.title.toLowerCase().includes(lower) ? 1 : 0;
        const bExact = b.title.toLowerCase().includes(lower) ? 1 : 0;
        return bExact - aExact;
      })
      .slice(0, limit);
  }
}

export const universalSearchService = new UniversalSearchService();
