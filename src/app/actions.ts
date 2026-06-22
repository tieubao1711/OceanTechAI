"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { locales, type Locale } from "@/i18n/routing";
import { prisma } from "@/server/db/prisma";
import { workspaceService } from "@/server/services/workspace.service";
import { projectService } from "@/server/services/project.service";
import { discussionService } from "@/server/services/discussion.service";
import { proposalService } from "@/server/services/proposal.service";
import { executiveService } from "@/server/services/executive.service";
import { autonomousReviewJob } from "@/server/autonomous/autonomous-review.job";
import { workforceService } from "@/server/workforce/workforce.service";
import { officeHoursService } from "@/server/office-hours/office-hours.service";
import { projectTeamService } from "@/server/workforce/project-team.service";
import { sidebarContextService } from "@/server/workforce/sidebar-context.service";
import { debateProgressService } from "@/server/services/debate-progress.service";
import type { AgentRank, AvatarType, Department } from "@prisma/client";

async function getDefaultUser() {
  const user = await prisma.user.findFirst();
  if (!user) throw new Error("No user found. Run: npm run db:seed");
  return user;
}

export async function createWorkspaceAction(formData: FormData) {
  const user = await getDefaultUser();
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || undefined;
  if (!name) throw new Error("Workspace name is required");

  const workspace = await workspaceService.create({
    name,
    description,
    ownerId: user.id,
  });

  revalidatePath("/workspaces");
  redirect(`/workspaces/${workspace.id}`);
}

export async function createProjectAction(formData: FormData) {
  const workspaceId = String(formData.get("workspaceId"));
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || undefined;
  if (!name) throw new Error("Project name is required");

  const project = await projectService.create({ name, description, workspaceId });
  revalidatePath(`/workspaces/${workspaceId}`);
  redirect(`/projects/${project.id}`);
}

export async function seedAgentsAction(projectId: string) {
  await projectService.seedDefaultAgents(projectId);
  revalidatePath(`/projects/${projectId}/agents`);
}

export async function toggleAgentAction(agentId: string, projectId: string, isActive: boolean) {
  await prisma.agent.update({
    where: { id: agentId },
    data: { isActive },
  });
  revalidatePath(`/projects/${projectId}/agents`);
}

export async function createDiscussionAction(formData: FormData) {
  const projectId = String(formData.get("projectId"));
  const userPrompt = String(formData.get("userPrompt") ?? "").trim();
  const modeRaw = String(formData.get("mode") ?? "normal");
  const mode = modeRaw === "architecture_audit" ? "architecture_audit" : "normal";
  if (!userPrompt) throw new Error("Discussion prompt is required");

  const discussion = await discussionService.create({ projectId, userPrompt, mode });
  revalidatePath(`/projects/${projectId}`);
  redirect(`/projects/${projectId}/discussions/${discussion.id}`);
}

export async function runDebateAction(discussionId: string, projectId: string) {
  await discussionService.runDebate(discussionId);
  revalidatePath(`/projects/${projectId}/discussions/${discussionId}`);
  revalidatePath(`/projects/${projectId}`);
}

export async function getDebateProgressAction(discussionId: string) {
  return debateProgressService.getProgress(discussionId);
}

export async function approveProposalAction(proposalId: string, projectId: string) {
  const user = await getDefaultUser();
  await proposalService.approve(proposalId, user.id);
  revalidatePath(`/projects/${projectId}/proposals/${proposalId}`);
  revalidatePath(`/projects/${projectId}/generated`);
}

export async function rejectProposalAction(proposalId: string, projectId: string) {
  const user = await getDefaultUser();
  await proposalService.reject(proposalId, user.id);
  revalidatePath(`/projects/${projectId}/proposals/${proposalId}`);
}

export async function requestChangesAction(proposalId: string, projectId: string) {
  const user = await getDefaultUser();
  await proposalService.requestChanges(
    proposalId,
    user.id,
    "Founder requests revisions"
  );
  revalidatePath(`/projects/${projectId}/proposals/${proposalId}`);
}

export async function executeToGitHubAction(proposalId: string, projectId: string) {
  await proposalService.executeToGitHub(proposalId);
  revalidatePath(`/projects/${projectId}/proposals/${proposalId}`);
}

export async function runAutonomousReviewAction(projectId: string) {
  await executiveService.runAutonomousReview(projectId);
  revalidatePath(`/projects/${projectId}/executive`);
}

export async function ignoreSuggestionAction(suggestionId: string, projectId: string) {
  await autonomousReviewJob.ignoreSuggestion(suggestionId);
  revalidatePath(`/projects/${projectId}/executive`);
}

export async function archiveSuggestionAction(suggestionId: string, projectId: string) {
  await autonomousReviewJob.archiveSuggestion(suggestionId);
  revalidatePath(`/projects/${projectId}/executive`);
}

export async function createDiscussionFromSuggestionAction(
  suggestionId: string,
  projectId: string
) {
  const suggestion = await prisma.autonomousSuggestion.findUniqueOrThrow({
    where: { id: suggestionId },
  });

  const discussion = await discussionService.create({
    projectId,
    userPrompt: `${suggestion.title}\n\nContext: ${suggestion.reason}`,
  });

  await autonomousReviewJob.markDiscussionCreated(suggestionId, discussion.id);
  revalidatePath(`/projects/${projectId}/executive`);
  redirect(`/projects/${projectId}/discussions/${discussion.id}`);
}

export async function setLocaleAction(locale: Locale) {
  if (!locales.includes(locale)) return;
  const store = await cookies();
  store.set("NEXT_LOCALE", locale, { path: "/", maxAge: 60 * 60 * 24 * 365 });
  revalidatePath("/", "layout");
}

export async function hireAgentAction(formData: FormData) {
  const projectId = String(formData.get("projectId"));
  const name = String(formData.get("name") ?? "").trim();
  const department = String(formData.get("department") ?? "ENGINEERING") as Department;
  const role = String(formData.get("role") ?? "backend_engineer").trim();
  const model = String(formData.get("model") ?? "mock/mock-v1").trim();
  const rank = String(formData.get("rank") ?? "SENIOR") as AgentRank;
  const title = String(formData.get("title") ?? "").trim() || undefined;
  const avatarType = String(formData.get("avatarType") ?? "CORPORATE") as AvatarType;
  if (!name) throw new Error("Agent name is required");

  await workforceService.hireAgent({
    projectId,
    name,
    department,
    role,
    model,
    rank,
    title,
    avatarType,
  });
  revalidatePath(`/projects/${projectId}/agents`);
  revalidatePath(`/projects/${projectId}/executive`);
}

export async function promoteAgentAction(agentId: string, projectId: string) {
  await workforceService.promote(agentId);
  revalidatePath(`/projects/${projectId}/agents`);
  revalidatePath(`/projects/${projectId}/executive`);
}

export async function demoteAgentAction(agentId: string, projectId: string) {
  await workforceService.demote(agentId);
  revalidatePath(`/projects/${projectId}/agents`);
  revalidatePath(`/projects/${projectId}/executive`);
}

export async function suspendAgentAction(agentId: string, projectId: string) {
  await workforceService.suspend(agentId);
  revalidatePath(`/projects/${projectId}/agents`);
  revalidatePath(`/projects/${projectId}/executive`);
}

export async function retireAgentAction(agentId: string, projectId: string) {
  await workforceService.retire(agentId);
  revalidatePath(`/projects/${projectId}/agents`);
  revalidatePath(`/projects/${projectId}/executive`);
}

export async function startOfficeHoursConversationAction(projectId: string, agentId: string) {
  const conversation = await officeHoursService.createConversation(projectId, agentId);
  revalidatePath(`/projects/${projectId}/agents/${agentId}/chat`);
  redirect(`/projects/${projectId}/agents/${agentId}/chat?conversationId=${conversation.id}`);
}

export async function sendOfficeHoursMessageAction(formData: FormData) {
  const conversationId = String(formData.get("conversationId"));
  const projectId = String(formData.get("projectId"));
  const agentId = String(formData.get("agentId"));
  const content = String(formData.get("content") ?? "").trim();
  if (!content) throw new Error("Message is required");

  await officeHoursService.sendFounderMessage(conversationId, content);
  revalidatePath(`/projects/${projectId}/agents/${agentId}/chat`);
  redirect(`/projects/${projectId}/agents/${agentId}/chat?conversationId=${conversationId}`);
}

export async function addAgentToProjectAction(formData: FormData) {
  const projectId = String(formData.get("projectId"));
  const agentId = String(formData.get("agentId"));
  const role = String(formData.get("role") ?? "").trim();
  const allocationPercent = Number(formData.get("allocationPercent") ?? 100);
  const isLead = formData.get("isLead") === "true";
  if (!agentId || !role) throw new Error("Agent and role are required");

  await projectTeamService.addAgentToProject({
    projectId,
    agentId,
    role,
    allocationPercent,
    isLead,
  });
  revalidatePath(`/projects/${projectId}`);
}

export async function removeAgentFromProjectAction(formData: FormData) {
  const projectId = String(formData.get("projectId"));
  const agentId = String(formData.get("agentId"));
  await projectTeamService.removeFromProject(projectId, agentId);
  revalidatePath(`/projects/${projectId}`);
}

export async function setProjectLeadAction(formData: FormData) {
  const projectId = String(formData.get("projectId"));
  const agentId = String(formData.get("agentId"));
  await projectTeamService.setLead(projectId, agentId);
  revalidatePath(`/projects/${projectId}`);
}

export async function updateProjectAssignmentAction(formData: FormData) {
  const projectId = String(formData.get("projectId"));
  const agentId = String(formData.get("agentId"));
  const role = String(formData.get("role") ?? "").trim() || undefined;
  const allocationRaw = formData.get("allocationPercent");
  const allocationPercent = allocationRaw != null && allocationRaw !== ""
    ? Number(allocationRaw)
    : undefined;

  await projectTeamService.updateAssignment({
    projectId,
    agentId,
    role,
    allocationPercent,
  });
  revalidatePath(`/projects/${projectId}`);
}

export async function loadSidebarAgentsAction(pathname: string, search?: string) {
  return sidebarContextService.getAgentsForSidebar({ pathname, search });
}

export async function loadSidebarChatAction(projectId: string, agentId: string) {
  return officeHoursService.loadSidebarChat(projectId, agentId);
}

export async function sendSidebarMessageAction(
  projectId: string,
  agentId: string,
  conversationId: string,
  content: string
) {
  await officeHoursService.sendFounderMessage(conversationId, content);
  return officeHoursService.getConversation(conversationId);
}

export async function sidebarCreateDiscussionAction(
  conversationId: string,
  projectId: string,
  messageId?: string
) {
  const discussion = await officeHoursService.createFormalDiscussion({
    conversationId,
    messageId,
  });
  return `/projects/${projectId}/discussions/${discussion.id}`;
}

export async function createDiscussionFromOfficeHoursAction(formData: FormData) {
  const conversationId = String(formData.get("conversationId"));
  const projectId = String(formData.get("projectId"));
  const messageId = String(formData.get("messageId") ?? "").trim() || undefined;

  const discussion = await officeHoursService.createFormalDiscussion({
    conversationId,
    messageId,
  });
  revalidatePath(`/projects/${projectId}/executive`);
  redirect(`/projects/${projectId}/discussions/${discussion.id}`);
}
