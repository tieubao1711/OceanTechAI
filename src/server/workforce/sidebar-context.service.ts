import { prisma } from "@/server/db/prisma";
import { formatAgentDisplayLabel } from "@/server/agents/project-roster";
import { agentAvatarService } from "./agent-avatar.service";
import { founderService } from "@/server/founder/founder.service";
import { DEPARTMENT_LABELS, type SidebarAgentView } from "./workforce-types";
import { getFounderScope } from "@/server/founder/founder-context";

export type SidebarPageContext =
  | "executive"
  | "agents"
  | "projects"
  | "project"
  | "discussions"
  | "learning"
  | "organization"
  | "search";

export function parseSidebarContext(pathname: string): {
  page: SidebarPageContext;
  projectId?: string;
} {
  if (pathname.match(/^\/projects\/[^/]+$/)) {
    return { page: "project", projectId: pathname.split("/")[2] };
  }
  if (pathname.startsWith("/executive")) return { page: "executive" };
  if (pathname.startsWith("/agents")) return { page: "agents" };
  if (pathname.startsWith("/projects")) return { page: "projects" };
  if (pathname.startsWith("/discussions")) return { page: "discussions" };
  if (pathname.startsWith("/learning")) return { page: "learning" };
  if (pathname.startsWith("/organization")) return { page: "organization" };
  return { page: "executive" };
}

export class SidebarContextService {
  async getAgentsForSidebar(params: {
    pathname: string;
    search?: string;
  }): Promise<SidebarAgentView[]> {
    const { page, projectId } = parseSidebarContext(params.pathname);
    const scope = await getFounderScope();

    if (params.search?.trim()) {
      const agents = await founderService.getGlobalAgents(params.search.trim());
      return this.toSidebarAgents(agents.map((a) => ({
        id: a.id,
        homeProjectId: a.homeProjectId,
        homeProjectName: a.homeProjectName,
        chatProjectId: projectId ?? a.homeProjectId,
        name: a.name,
        displayName: a.displayName,
        title: a.title,
        department: a.departmentLabel,
        role: a.role,
        avatarEmoji: a.avatarEmoji,
        avatarColor: a.avatarColor,
        canChat: a.status === "active",
      })));
    }

    if (page === "project" && projectId) {
      return this.projectAssignedAgents(projectId);
    }

    if (page === "learning") {
      return this.agentsByRoles(scope.projectIds, [
        "system_architect",
        "qa_engineer",
        "red_team",
      ], projectId);
    }

    if (page === "discussions") {
      return this.recentDiscussionParticipants(scope.projectIds);
    }

    const global = await founderService.getGlobalAgents();
    return this.toSidebarAgents(
      global.slice(0, 8).map((a) => ({
        id: a.id,
        homeProjectId: a.homeProjectId,
        homeProjectName: a.homeProjectName,
        chatProjectId: projectId ?? a.homeProjectId,
        name: a.name,
        displayName: a.displayName,
        title: a.title,
        department: a.departmentLabel,
        role: a.role,
        avatarEmoji: a.avatarEmoji,
        avatarColor: a.avatarColor,
        canChat: a.status === "active",
      }))
    );
  }

  private async projectAssignedAgents(projectId: string): Promise<SidebarAgentView[]> {
    const [rows, project] = await Promise.all([
      prisma.projectAssignment.findMany({
        where: { projectId },
        include: { agent: { include: { project: { select: { name: true } } } } },
        orderBy: [{ isLead: "desc" }, { allocationPercent: "desc" }],
      }),
      prisma.project.findUniqueOrThrow({
        where: { id: projectId },
        select: { name: true },
      }),
    ]);
    return this.toSidebarAgents(
      rows.map((r) => {
        const avatar = agentAvatarService.resolve(r.agent.avatarSeed ?? r.agent.name, r.agent.avatarType);
        const canChat = r.agent.workforceStatus === "ACTIVE" && r.agent.isActive;
        const homeProjectName = r.agent.project.name;
        return {
          id: r.agent.id,
          homeProjectId: r.agent.projectId,
          homeProjectName,
          chatProjectId: projectId,
          name: r.agent.name,
          displayName: formatAgentDisplayLabel({
            name: r.agent.name,
            homeProjectName,
            showProject: homeProjectName !== project.name,
          }),
          title: r.agent.title ?? r.role,
          department: DEPARTMENT_LABELS[r.agent.department],
          role: r.agent.role,
          avatarEmoji: avatar.emoji,
          avatarColor: avatar.color,
          canChat,
        };
      })
    );
  }

  private async agentsByRoles(
    projectIds: string[],
    roles: string[],
    chatProjectId?: string
  ): Promise<SidebarAgentView[]> {
    const agents = await prisma.agent.findMany({
      where: {
        projectId: { in: projectIds },
        role: { in: roles },
        workforceStatus: "ACTIVE",
        isActive: true,
      },
      include: { project: { select: { name: true } } },
      take: 8,
    });
    return this.toSidebarAgents(
      agents.map((a) => {
        const avatar = agentAvatarService.resolve(a.avatarSeed ?? a.name, a.avatarType);
        const homeProjectName = a.project.name;
        return {
          id: a.id,
          homeProjectId: a.projectId,
          homeProjectName,
          chatProjectId: chatProjectId ?? a.projectId,
          name: a.name,
          displayName: formatAgentDisplayLabel({
            name: a.name,
            homeProjectName,
            showProject: true,
          }),
          title: a.title ?? a.role,
          department: DEPARTMENT_LABELS[a.department],
          role: a.role,
          avatarEmoji: avatar.emoji,
          avatarColor: avatar.color,
          canChat: true,
        };
      })
    );
  }

  private async recentDiscussionParticipants(projectIds: string[]): Promise<SidebarAgentView[]> {
    const discussions = await prisma.discussion.findMany({
      where: { projectId: { in: projectIds } },
      orderBy: { updatedAt: "desc" },
      take: 5,
      include: {
        rounds: {
          include: {
            messages: { include: { agent: true }, take: 1 },
          },
        },
        project: { select: { id: true, name: true } },
      },
    });

    const seen = new Set<string>();
    const agents: SidebarAgentView[] = [];

    for (const d of discussions) {
      for (const round of d.rounds) {
        for (const msg of round.messages) {
          if (seen.has(msg.agent.id)) continue;
          seen.add(msg.agent.id);
          const avatar = agentAvatarService.resolve(
            msg.agent.avatarSeed ?? msg.agent.name,
            msg.agent.avatarType
          );
          const homeAgent = await prisma.agent.findUnique({
            where: { id: msg.agent.id },
            include: { project: { select: { name: true } } },
          });
          const homeProjectName = homeAgent?.project.name ?? d.project.name;
          agents.push({
            id: msg.agent.id,
            homeProjectId: msg.agent.projectId,
            homeProjectName,
            chatProjectId: d.project.id,
            name: msg.agent.name,
            displayName: formatAgentDisplayLabel({
              name: msg.agent.name,
              homeProjectName,
              showProject: true,
            }),
            title: msg.agent.title ?? msg.agent.role,
            department: DEPARTMENT_LABELS[msg.agent.department],
            role: msg.agent.role,
            avatarEmoji: avatar.emoji,
            avatarColor: avatar.color,
            canChat: msg.agent.workforceStatus === "ACTIVE" && msg.agent.isActive,
            lastMessagePreview: null,
            conversationId: null,
          });
          if (agents.length >= 8) return agents;
        }
      }
    }
    return agents;
  }

  private async toSidebarAgents(
    base: Array<{
      id: string;
      homeProjectId: string;
      homeProjectName: string;
      chatProjectId: string;
      name: string;
      displayName: string;
      title: string;
      department: string;
      role: string;
      avatarEmoji: string;
      avatarColor: string;
      canChat: boolean;
    }>
  ): Promise<SidebarAgentView[]> {
    const result: SidebarAgentView[] = [];
    for (const a of base) {
      const conv = await prisma.agentConversation.findFirst({
        where: { projectId: a.chatProjectId, agentId: a.id },
        orderBy: { updatedAt: "desc" },
        include: { messages: { orderBy: { createdAt: "desc" }, take: 1 } },
      });
      result.push({
        ...a,
        lastMessagePreview: conv?.messages[0]?.content.slice(0, 80) ?? null,
        conversationId: conv?.id ?? null,
      });
    }
    return result;
  }
}

export const sidebarContextService = new SidebarContextService();
