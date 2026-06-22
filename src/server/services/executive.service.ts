import { executiveBriefingService } from "@/server/insights/executive-briefing.service";
import { timelineService } from "@/server/insights/timeline.service";
import { journalService } from "@/server/journals/journal.service";
import { autonomousReviewJob } from "@/server/autonomous/autonomous-review.job";
import { adrService } from "@/server/insights/adr.service";
import { recommendationEngine } from "@/server/recommendations/recommendation-engine";
import { auditHealthService } from "@/server/audit/audit-health.service";
import { learningCaptureService } from "@/server/learning/learning-capture.service";
import { recommendationConsistencyService } from "@/server/learning/integrity/recommendation-consistency.service";
import { agentCouncilService } from "@/server/agents/agent-council.service";
import { agentIdentityService } from "@/server/agents/agent-identity.service";
import type { RecommendedAction } from "@/server/recommendations/recommendation-engine";
import { companyOverviewService } from "@/server/workforce/company-overview.service";
import { organizationChartService } from "@/server/workforce/organization-chart.service";
import { projectAssignmentService } from "@/server/workforce/project-assignment.service";
import { workforceService } from "@/server/workforce/workforce.service";
import { founderQueriesService } from "@/server/workforce/founder-queries.service";
import { prisma } from "@/server/db/prisma";

export class ExecutiveService {
  getMorningBrief(projectId: string) {
    return executiveBriefingService.generateMorningBrief(projectId);
  }

  getTimeline(projectId: string) {
    return timelineService.listByProject(projectId);
  }

  getJournals(projectId: string) {
    return journalService.listByProject(projectId);
  }

  getSuggestions(projectId: string) {
    return autonomousReviewJob.listSuggestions(projectId);
  }

  runAutonomousReview(projectId: string) {
    return autonomousReviewJob.run(projectId);
  }

  getAdrs(projectId: string) {
    return adrService.listByProject(projectId);
  }

  getRecommendations(projectId: string) {
    return recommendationEngine.generate(projectId);
  }

  getArchitectureHealth(projectId: string) {
    return auditHealthService.getArchitectureHealth(projectId);
  }

  getLearningCenter(projectId: string) {
    return learningCaptureService.getLearningCenterData(projectId);
  }

  getAgentCouncil(projectId: string) {
    return agentCouncilService.getCouncilInsights(projectId);
  }

  getAgentProfile(projectId: string, agentId: string) {
    return agentIdentityService.getAgentProfile(projectId, agentId);
  }

  async getCompanyOverview(projectId: string) {
    const project = await prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      select: { workspaceId: true },
    });
    return companyOverviewService.getOverview(project.workspaceId);
  }

  async getOrganizationChart(projectId: string) {
    const project = await prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      select: { workspaceId: true },
    });
    return organizationChartService.getChart(project.workspaceId);
  }

  getProjectTeam(projectId: string) {
    return projectAssignmentService.getProjectTeam(projectId);
  }

  getPromotionCandidates(projectId: string) {
    return workforceService.getPromotionCandidates(projectId);
  }

  async getOverallocatedAgents(projectId: string) {
    const project = await prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      select: { workspaceId: true },
    });
    const over = await projectAssignmentService.getOverallocatedAgents(project.workspaceId);
    const agents = await prisma.agent.findMany({
      where: { id: { in: over.map((o) => o.agentId) } },
      select: { id: true, name: true, title: true },
    });
    const byId = new Map(agents.map((a) => [a.id, a]));
    return over.map((o) => ({
      ...o,
      name: byId.get(o.agentId)?.name ?? o.agentId,
      title: byId.get(o.agentId)?.title ?? null,
    }));
  }

  async getFounderInsights(projectId: string) {
    const project = await prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      select: { workspaceId: true, name: true, id: true },
    });
    const [
      projectOwner,
      leadArchitect,
      overloaded,
      topContributors,
      inactive,
      promotionCandidates,
      multiProject,
      bestDepartment,
    ] = await Promise.all([
      founderQueriesService.whoOwnsProject(project.id),
      founderQueriesService.whoIsLeadArchitect(project.workspaceId),
      founderQueriesService.whoIsOverloaded(project.workspaceId),
      founderQueriesService.whoContributesMost(project.id),
      founderQueriesService.whoIsInactive(project.id),
      founderQueriesService.whoShouldBePromoted(project.id),
      founderQueriesService.whoWorksOnMultipleProjects(project.workspaceId),
      founderQueriesService.bestPerformingDepartment(project.workspaceId),
    ]);
    return {
      projectOwner,
      leadArchitect,
      overloaded,
      topContributors,
      inactive,
      promotionCandidates,
      multiProject,
      bestDepartment,
    };
  }

  async getRecommendationConsistency(
    projectId: string,
    recommendedActions: RecommendedAction[]
  ) {
    const learningCenter = await learningCaptureService.getLearningCenterData(projectId);
    return recommendationConsistencyService.checkProject({
      projectId,
      recommendedActions,
      repeatedMistakes: learningCenter.repeatedMistakes,
      activeLearnings: learningCenter.activeLearnings,
      verifiedImprovementTitles: learningCenter.verifiedImprovements.map((c) => c.title),
    });
  }
}

export const executiveService = new ExecutiveService();
