import { prisma } from "@/server/db/prisma";
import { agentIdentityService } from "@/server/agents/agent-identity.service";
import { agentCouncilService } from "@/server/agents/agent-council.service";
import { auditHealthService } from "@/server/audit/audit-health.service";
import { executiveService } from "@/server/services/executive.service";
import { organizationChartService } from "@/server/workforce/organization-chart.service";
import { projectAssignmentService } from "@/server/workforce/project-assignment.service";
import { companyOverviewService } from "@/server/workforce/company-overview.service";
import { formatAgentDisplayLabel } from "@/server/agents/project-roster";
import { DEPARTMENT_LABELS } from "@/server/workforce/workforce-types";
import { learningCaptureService } from "@/server/learning/learning-capture.service";
import { getFounderScope } from "./founder-context";
import type {
  FounderHomeSnapshots,
  GlobalAgentView,
  GlobalDiscussionView,
  GlobalLearningView,
  GlobalProjectView,
} from "./founder-types";

function matchesSearch(text: string, query: string): boolean {
  return text.toLowerCase().includes(query.toLowerCase());
}

export class FounderService {
  async getGlobalAgents(search?: string): Promise<GlobalAgentView[]> {
    const scope = await getFounderScope();
    if (scope.projectIds.length === 0) return [];

    const agents = await prisma.agent.findMany({
      where: { projectId: { in: scope.projectIds }, workforceStatus: { not: "RETIRED" } },
      include: { project: { select: { name: true } } },
      orderBy: [{ reputationScore: "desc" }, { name: "asc" }],
    });

    const results: GlobalAgentView[] = [];
    for (const agent of agents) {
      const [member, assignments] = await Promise.all([
        agentIdentityService.buildCouncilMember(agent, agent.projectId),
        projectAssignmentService.listByAgent(agent.id),
      ]);

      const activeProjects = [
        ...new Set(assignments.map((a) => a.projectName)),
      ];
      if (activeProjects.length === 0) activeProjects.push(agent.project.name);

      const view: GlobalAgentView = {
        id: agent.id,
        homeProjectId: agent.projectId,
        homeProjectName: agent.project.name,
        name: agent.name,
        displayName: formatAgentDisplayLabel({
          name: agent.name,
          homeProjectName: agent.project.name,
          showProject: true,
        }),
        title: agent.title ?? member.title,
        department: agent.department,
        departmentLabel: DEPARTMENT_LABELS[agent.department],
        rank: agent.rank,
        role: agent.role,
        expertise: agent.expertise,
        reputation: member.reputation,
        influenceScore: member.influenceScore,
        status: member.status,
        avatarEmoji: member.avatarEmoji,
        avatarColor: member.avatarColor,
        activeProjects,
        profileHref: `/projects/${agent.projectId}/agents/${agent.id}`,
        officeHoursHref: `/projects/${agent.projectId}/agents/${agent.id}/chat`,
      };

      if (search?.trim()) {
        const q = search.trim();
        const blob = [
          view.name,
          view.title,
          view.departmentLabel,
          view.role,
          ...view.expertise,
          ...view.activeProjects,
        ].join(" ");
        if (!matchesSearch(blob, q)) continue;
      }

      results.push(view);
    }

    return results;
  }

  async getGlobalProjects(): Promise<GlobalProjectView[]> {
    const scope = await getFounderScope();
    if (scope.projectIds.length === 0) return [];

    const projects = await prisma.project.findMany({
      where: { id: { in: scope.projectIds } },
      include: { workspace: { select: { name: true } } },
      orderBy: { name: "asc" },
    });

    const views: GlobalProjectView[] = [];
    for (const project of projects) {
      const [teamSize, openDiscussions, openProposals, lead, health] = await Promise.all([
        prisma.agent.count({
          where: { projectId: project.id, workforceStatus: "ACTIVE", isActive: true },
        }),
        prisma.discussion.count({
          where: { projectId: project.id, status: { in: ["DRAFT", "RUNNING"] } },
        }),
        prisma.proposal.count({
          where: {
            discussion: { projectId: project.id },
            status: { in: ["PENDING", "CHANGES_REQUESTED"] },
          },
        }),
        projectAssignmentService.findProjectLead(project.id),
        auditHealthService.getArchitectureHealth(project.id).catch(() => null),
      ]);

      views.push({
        id: project.id,
        name: project.name,
        description: project.description,
        workspaceName: project.workspace.name,
        leadName: lead?.agentName ?? null,
        teamSize,
        openDiscussions,
        openProposals,
        healthScore: health?.overallScore ?? null,
        href: `/projects/${project.id}`,
      });
    }

    return views;
  }

  async getGlobalDiscussions(filters?: {
    projectId?: string;
    status?: string;
    topic?: string;
  }): Promise<GlobalDiscussionView[]> {
    const scope = await getFounderScope();

    const discussions = await prisma.discussion.findMany({
      where: {
        projectId: {
          in: filters?.projectId ? [filters.projectId] : scope.projectIds,
        },
        ...(filters?.status ? { status: filters.status as "DRAFT" | "RUNNING" | "COMPLETED" | "FAILED" } : {}),
        ...(filters?.topic
          ? { userPrompt: { contains: filters.topic, mode: "insensitive" } }
          : {}),
      },
      include: {
        project: { select: { name: true } },
        proposal: { select: { status: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return discussions.map((d) => ({
      id: d.id,
      projectId: d.projectId,
      projectName: d.project.name,
      userPrompt: d.userPrompt,
      status: d.status,
      mode: d.mode,
      createdAt: d.createdAt,
      proposalStatus: d.proposal?.status ?? null,
      href: `/projects/${d.projectId}/discussions/${d.id}`,
    }));
  }

  async getGlobalLearning(): Promise<GlobalLearningView> {
    const scope = await getFounderScope();
    const projects = await prisma.project.findMany({
      where: { id: { in: scope.projectIds } },
      select: { id: true, name: true },
    });

    const allData = await Promise.all(
      projects.map(async (p) => {
        const [learning, adrs] = await Promise.all([
          learningCaptureService.getLearningCenterData(p.id),
          executiveService.getAdrs(p.id),
        ]);
        return { project: p, learning, adrs };
      })
    );

    const verifiedImprovements = allData.flatMap((d) =>
      d.learning.verifiedImprovements.map((v) => ({
        title: v.title,
        projectName: d.project.name,
        projectId: d.project.id,
      }))
    );

    const repeatedMistakes = allData.flatMap((d) =>
      d.learning.repeatedMistakes.map((m) => ({
        title: m.title,
        projectName: d.project.name,
        status: m.status,
      }))
    );

    const topLearnings = allData
      .flatMap((d) =>
        d.learning.activeLearnings.map((l) => ({
          title: l.title,
          projectName: d.project.name,
          evidenceCount: l.evidenceCount,
        }))
      )
      .sort((a, b) => b.evidenceCount - a.evidenceCount)
      .slice(0, 10);

    const recentAdrs = allData
      .flatMap((d) =>
        d.adrs.slice(0, 3).map((a) => ({
          title: a.title,
          projectName: d.project.name,
          projectId: d.project.id,
        }))
      )
      .slice(0, 10);

    const improvementCycles = allData
      .flatMap((d) =>
        [...d.learning.verifiedImprovements, ...d.learning.openCycles].map((c) => ({
          title: c.title,
          status: "status" in c ? c.status : "VERIFIED",
          projectName: d.project.name,
        }))
      )
      .slice(0, 10);

    const healthScores = allData.map((d) => d.learning.health.memoryHealthScore);
    const healthScore =
      healthScores.length > 0
        ? Math.round(healthScores.reduce((s, h) => s + h, 0) / healthScores.length)
        : 0;

    return {
      verifiedImprovements: verifiedImprovements.slice(0, 10),
      repeatedMistakes: repeatedMistakes.slice(0, 10),
      topLearnings,
      recentAdrs,
      improvementCycles,
      healthScore,
    };
  }

  async getGlobalOrganization() {
    const scope = await getFounderScope();
    const charts = await Promise.all(
      scope.workspaceIds.map((id) => organizationChartService.getChart(id))
    );

    const assignments = await prisma.projectAssignment.findMany({
      where: { project: { id: { in: scope.projectIds } } },
      include: {
        agent: { select: { name: true, title: true, department: true } },
        project: { select: { name: true } },
      },
      orderBy: { allocationPercent: "desc" },
    });

    const projectLeads = await Promise.all(
      scope.projectIds.map(async (id) => {
        const project = await prisma.project.findUnique({
          where: { id },
          select: { id: true, name: true },
        });
        const lead = await projectAssignmentService.findProjectLead(id);
        return {
          projectId: id,
          projectName: project?.name ?? id,
          leadName: lead?.agentName ?? null,
          leadRole: lead?.role ?? null,
        };
      })
    );

    return {
      departments: charts.flatMap((c) => c.departments),
      assignments: assignments.map((a) => ({
        agentName: a.agent.name,
        agentTitle: a.agent.title,
        department: DEPARTMENT_LABELS[a.agent.department],
        projectName: a.project.name,
        role: a.role,
        allocationPercent: a.allocationPercent,
        isLead: a.isLead,
      })),
      projectOwnership: projectLeads,
    };
  }

  async getFounderHome(): Promise<FounderHomeSnapshots> {
    const scope = await getFounderScope();
    const [agents, projects, recentDiscussions, brief, learning, overview] =
      await Promise.all([
        this.getGlobalAgents(),
        this.getGlobalProjects(),
        this.getGlobalDiscussions(),
        scope.primaryProjectId
          ? executiveService.getMorningBrief(scope.primaryProjectId)
          : null,
        this.getGlobalLearning(),
        scope.primaryWorkspaceId
          ? companyOverviewService.getOverview(scope.primaryWorkspaceId)
          : null,
      ]);

    const recentDecisions = scope.primaryProjectId
      ? (await executiveService.getTimeline(scope.primaryProjectId))
          .filter((e) => e.eventType.includes("DECISION") || e.eventType.includes("APPROVED"))
          .slice(0, 5)
          .map((e) => ({
            title: e.title,
            projectName:
              projects.find((p) => p.id === scope.primaryProjectId)?.name ?? "",
            occurredAt: e.occurredAt,
            href: `/projects/${scope.primaryProjectId}/timeline`,
          }))
      : [];

    const openDiscussions = projects.reduce((s, p) => s + p.openDiscussions, 0);
    const openProposals = projects.reduce((s, p) => s + p.openProposals, 0);

    return {
      agents: agents.slice(0, 6),
      projects: projects.slice(0, 5),
      recentDiscussions: recentDiscussions.slice(0, 5),
      recentDecisions,
      learning: {
        verifiedCount: learning.verifiedImprovements.length,
        mistakesCount: learning.repeatedMistakes.length,
        activeLearningsCount: learning.topLearnings.length,
        healthScore: learning.healthScore,
      },
      companyOverview: {
        totalAgents: overview?.totalAgents ?? agents.length,
        activeAgents: overview?.activeAgents ?? agents.filter((a) => a.status === "active").length,
        projects: projects.length,
        openDiscussions,
        openProposals,
        averageReputation: overview?.averageReputation ?? 0,
      },
      topRisks: brief?.topRisks ?? [],
    };
  }

  async getCouncilSnapshot(limit = 6) {
    const scope = await getFounderScope();
    if (!scope.primaryProjectId) return { members: [], topContributors: [], requiringReview: [] };
    return agentCouncilService.getCouncilInsights(scope.primaryProjectId).then((c) => ({
      members: c.members.slice(0, limit),
      topContributors: c.topContributors.slice(0, 3),
      requiringReview: c.requiringReview.slice(0, 3),
    }));
  }
}

export const founderService = new FounderService();
