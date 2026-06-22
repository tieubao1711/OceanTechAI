import { prisma } from "@/server/db/prisma";
import { memoryService } from "@/server/memory/memory.service";
import { projectKnowledgeService } from "@/server/knowledge/project-knowledge.service";
import { learningCaptureService } from "@/server/learning/learning-capture.service";
import { projectAssignmentService } from "@/server/workforce/project-assignment.service";
import { discussionService } from "@/server/services/discussion.service";
import { assertAgentCanChat } from "./office-hours-governance";
import { officeHoursPromptBuilder } from "./office-hours-prompt-builder";
import { officeHoursRunner } from "./office-hours-runner";
import {
  OFFICE_HOURS_LIMITS,
  type OfficeHoursContextBundle,
  type OfficeHoursConversationSummary,
  type OfficeHoursConversationView,
  type OfficeHoursMessageRole,
} from "./office-hours-types";

function toMessageView(row: {
  id: string;
  role: string;
  content: string;
  tokenInput: number | null;
  tokenOutput: number | null;
  tokenTotal: number | null;
  provider: string | null;
  model: string | null;
  fallbackUsed: boolean;
  createdAt: Date;
}) {
  return {
    id: row.id,
    role: row.role as OfficeHoursMessageRole,
    content: row.content,
    tokenInput: row.tokenInput,
    tokenOutput: row.tokenOutput,
    tokenTotal: row.tokenTotal,
    provider: row.provider,
    model: row.model,
    fallbackUsed: row.fallbackUsed,
    createdAt: row.createdAt,
  };
}

export class OfficeHoursService {
  async assertAgentOnProject(projectId: string, agentId: string) {
    const agent = await prisma.agent.findUniqueOrThrow({ where: { id: agentId } });
    if (agent.projectId !== projectId) {
      const assigned = await prisma.projectAssignment.findUnique({
        where: { projectId_agentId: { projectId, agentId } },
      });
      if (!assigned) {
        throw new Error("Agent is not assigned to this project.");
      }
    }
    assertAgentCanChat(agent);
    return agent;
  }

  async getOrCreateConversation(projectId: string, agentId: string) {
    await this.assertAgentOnProject(projectId, agentId);
    const existing = await prisma.agentConversation.findFirst({
      where: { projectId, agentId },
      orderBy: { updatedAt: "desc" },
    });
    if (existing) return existing;
    return this.createConversation(projectId, agentId);
  }

  async createConversation(projectId: string, agentId: string, title?: string) {
    const agent = await this.assertAgentOnProject(projectId, agentId);

    return prisma.agentConversation.create({
      data: {
        projectId,
        agentId,
        title: title ?? `Office Hours with ${agent.name.split("—")[0]?.trim() ?? agent.name}`,
      },
    });
  }

  async listConversations(
    projectId: string,
    agentId?: string
  ): Promise<OfficeHoursConversationSummary[]> {
    const rows = await prisma.agentConversation.findMany({
      where: { projectId, ...(agentId ? { agentId } : {}) },
      include: {
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
        _count: { select: { messages: true } },
      },
      orderBy: { updatedAt: "desc" },
    });

    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      updatedAt: r.updatedAt,
      messageCount: r._count.messages,
      preview: r.messages[0]?.content.slice(0, 120) ?? null,
    }));
  }

  async getConversation(conversationId: string): Promise<OfficeHoursConversationView> {
    const row = await prisma.agentConversation.findUniqueOrThrow({
      where: { id: conversationId },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });

    return {
      id: row.id,
      projectId: row.projectId,
      agentId: row.agentId,
      title: row.title,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      messages: row.messages.map(toMessageView),
    };
  }

  async loadSidebarChat(projectId: string, agentId: string) {
    const conversation = await this.getOrCreateConversation(projectId, agentId);
    return this.getConversation(conversation.id);
  }

  async sendFounderMessage(conversationId: string, content: string) {
    const trimmed = content.trim();
    if (!trimmed) throw new Error("Message cannot be empty.");

    const conversation = await prisma.agentConversation.findUniqueOrThrow({
      where: { id: conversationId },
      include: {
        agent: true,
        project: { include: { workspace: true } },
        messages: { orderBy: { createdAt: "desc" }, take: OFFICE_HOURS_LIMITS.maxConversationMessages },
      },
    });

    await this.assertAgentOnProject(conversation.projectId, conversation.agentId);

    await prisma.agentConversationMessage.create({
      data: { conversationId, role: "founder", content: trimmed },
    });

    const context = await this.buildContext({
      agent: conversation.agent,
      project: conversation.project,
      workspaceId: conversation.project.workspaceId,
      recentMessages: [...conversation.messages].reverse().map((m) => ({
        role: m.role as OfficeHoursMessageRole,
        content: m.content,
      })),
    });

    const systemPrompt = officeHoursPromptBuilder.buildSystemPrompt(conversation.agent);
    const userPrompt = officeHoursPromptBuilder.buildUserPrompt({
      founderMessage: trimmed,
      context,
    });

    const result = await officeHoursRunner.run({
      agent: conversation.agent,
      systemPrompt,
      userPrompt,
      founderMessage: trimmed,
    });

    const agentMessage = await prisma.agentConversationMessage.create({
      data: {
        conversationId,
        role: "agent",
        content: result.content,
        tokenInput: result.tokenInput,
        tokenOutput: result.tokenOutput,
        tokenTotal: result.tokenTotal,
        provider: result.provider,
        model: result.model,
        fallbackUsed: result.fallbackUsed,
      },
    });

    await prisma.agentConversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    return {
      founderMessage: trimmed,
      agentMessage: toMessageView(agentMessage),
      run: result,
    };
  }

  async createFormalDiscussion(params: {
    conversationId: string;
    messageId?: string;
    useFullThread?: boolean;
  }) {
    const conversation = await prisma.agentConversation.findUniqueOrThrow({
      where: { id: params.conversationId },
      include: {
        agent: true,
        messages: { orderBy: { createdAt: "asc" } },
      },
    });

    let contextBody: string;
    if (params.useFullThread) {
      contextBody = conversation.messages
        .map((m) => `${m.role === "founder" ? "Founder" : conversation.agent.name}: ${m.content}`)
        .join("\n\n");
    } else if (params.messageId) {
      const msg = conversation.messages.find((m) => m.id === params.messageId);
      if (!msg) throw new Error("Message not found.");
      contextBody = msg.content;
    } else {
      const lastAgent = [...conversation.messages].reverse().find((m) => m.role === "agent");
      if (!lastAgent) throw new Error("No agent response to convert.");
      contextBody = lastAgent.content;
    }

    const userPrompt = [
      `Formal discussion requested from Office Hours with ${conversation.agent.name}.`,
      "",
      "Office Hours context (advisory — not approved):",
      contextBody,
      "",
      "Founder requests the council to debate and produce a formal proposal on the above.",
    ].join("\n");

    return discussionService.create({
      projectId: conversation.projectId,
      userPrompt,
      mode: "normal",
    });
  }

  private async buildContext(params: {
    agent: {
      id: string;
      role: string;
      memorySummary: string | null;
      projectId: string;
    };
    project: { name: string; description: string | null; id: string };
    workspaceId: string;
    recentMessages: Array<{ role: OfficeHoursMessageRole; content: string }>;
  }): Promise<OfficeHoursContextBundle> {
    const [assignments, memoryBlock, journals, debateMessages, learning, knowledgeSnapshot] =
      await Promise.all([
        projectAssignmentService.listByAgent(params.agent.id),
        memoryService.buildContextForDiscussion({
          workspaceId: params.workspaceId,
          projectId: params.project.id,
          agentRole: params.agent.role,
        }),
        prisma.agentJournal.findMany({
          where: { agentId: params.agent.id, projectId: params.project.id },
          orderBy: { createdAt: "desc" },
          take: OFFICE_HOURS_LIMITS.maxJournals,
          select: { title: true, content: true, type: true },
        }),
        prisma.agentMessage.findMany({
          where: { agentId: params.agent.id, round: { discussion: { projectId: params.project.id } } },
          orderBy: { createdAt: "desc" },
          take: OFFICE_HOURS_LIMITS.maxDebateMessages,
          select: { stance: true, content: true, round: { select: { roundType: true } } },
        }),
        learningCaptureService.getLearningCenterData(params.project.id),
        projectKnowledgeService.buildForProject(params.project.id),
      ]);

    const agentMemory = params.agent.memorySummary
      ? `Summary: ${params.agent.memorySummary}`
      : "";
    const memoryCombined = [agentMemory, memoryBlock].filter(Boolean).join("\n");

    const learningRecords = [
      ...learning.activeLearnings.slice(0, OFFICE_HOURS_LIMITS.maxLearningRecords).map((l) => l.title),
      ...learning.repeatedMistakes.slice(0, 2).map((m) => `Mistake: ${m.title}`),
    ].slice(0, OFFICE_HOURS_LIMITS.maxLearningRecords);

    return {
      projectName: params.project.name,
      projectDescription: params.project.description,
      assignments: assignments.map(
        (a) => `${a.projectName}: ${a.role} (${a.allocationPercent}%)`
      ),
      memoryBlock: memoryCombined,
      journals: journals.map((j) => `${j.type}: ${j.title} — ${j.content.slice(0, 120)}`),
      debatePositions: debateMessages.map(
        (m) => `${m.round.roundType} [${m.stance}]: ${m.content.slice(0, 150)}`
      ),
      learningRecords,
      projectKnowledge: officeHoursPromptBuilder.formatCompactProjectKnowledge(knowledgeSnapshot),
      recentMessages: params.recentMessages.slice(-OFFICE_HOURS_LIMITS.maxConversationMessages),
    };
  }
}

export const officeHoursService = new OfficeHoursService();
