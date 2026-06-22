import { describe, it, expect, vi, beforeEach } from "vitest";
import { OfficeHoursService } from "@/server/office-hours/office-hours.service";
import { GovernanceError } from "@/server/errors/governance-error";

const mockAgentFind = vi.fn();
const mockConversationCreate = vi.fn();
const mockConversationFind = vi.fn();
const mockConversationUpdate = vi.fn();
const mockMessageCreate = vi.fn();
const mockJournalFind = vi.fn();
const mockAgentMessageFind = vi.fn();
const mockDiscussionCreate = vi.fn();

vi.mock("@/server/db/prisma", () => ({
  prisma: {
    agent: { findUniqueOrThrow: (...args: unknown[]) => mockAgentFind(...args) },
    projectAssignment: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
    agentConversation: {
      create: (...args: unknown[]) => mockConversationCreate(...args),
      findMany: vi.fn().mockResolvedValue([]),
      findUniqueOrThrow: (...args: unknown[]) => mockConversationFind(...args),
      update: (...args: unknown[]) => mockConversationUpdate(...args),
    },
    agentConversationMessage: {
      create: (...args: unknown[]) => mockMessageCreate(...args),
    },
    agentJournal: { findMany: (...args: unknown[]) => mockJournalFind(...args) },
    agentMessage: { findMany: (...args: unknown[]) => mockAgentMessageFind(...args) },
  },
}));

vi.mock("@/server/memory/memory.service", () => ({
  memoryService: { buildContextForDiscussion: vi.fn().mockResolvedValue("Workspace memory block") },
}));

vi.mock("@/server/knowledge/project-knowledge.service", () => ({
  projectKnowledgeService: {
    buildForProject: vi.fn().mockResolvedValue({
      architectureSummary: "Next.js modular",
      existingModules: ["debate"],
      existingServices: ["office-hours.service.ts"],
      knownConstraints: ["Founder approval"],
      recentADRs: ["ADR-1"],
      prismaModels: ["Agent"],
      existingPages: [],
      existingIntegrations: [],
      existingTests: [],
      auditFileMap: [],
      recentDecisions: [],
    }),
  },
}));

vi.mock("@/server/learning/learning-capture.service", () => ({
  learningCaptureService: {
    getLearningCenterData: vi.fn().mockResolvedValue({
      activeLearnings: [{ title: "Lifecycle integrity" }],
      repeatedMistakes: [],
      verifiedImprovements: [],
      reopenedProblems: [],
      health: {},
      openCycles: [],
      verifiedTopicCount: 1,
    }),
  },
}));

vi.mock("@/server/workforce/project-assignment.service", () => ({
  projectAssignmentService: {
    listByAgent: vi.fn().mockResolvedValue([
      { projectName: "Core", role: "Lead Architect", allocationPercent: 100 },
    ]),
  },
}));

vi.mock("@/server/office-hours/office-hours-runner", () => ({
  officeHoursRunner: {
    run: vi.fn().mockResolvedValue({
      content: "Prioritize debate integrity and modular services this week.",
      provider: "mock",
      model: "mock-v1",
      tokenTotal: 120,
      fallbackUsed: false,
    }),
  },
}));

vi.mock("@/server/services/discussion.service", () => ({
  discussionService: {
    create: (...args: unknown[]) => mockDiscussionCreate(...args),
  },
}));

describe("office-hours.service", () => {
  const service = new OfficeHoursService();

  const activeAgent = {
    id: "a1",
    projectId: "p1",
    name: "Sam — Architect",
    role: "system_architect",
    department: "ENGINEERING",
    title: "Lead Architect",
    rank: "LEAD",
    workforceStatus: "ACTIVE",
    isActive: true,
    memorySummary: "Uses PostgreSQL",
    systemPrompt: "Architect focus",
    expertise: ["architecture"],
    avatarType: "FANTASY",
    avatarSeed: "sam",
    modelProvider: "mock",
    modelName: "mock-v1",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockJournalFind.mockResolvedValue([]);
    mockAgentMessageFind.mockResolvedValue([]);
  });

  it("creates conversation for active agent", async () => {
    mockAgentFind.mockResolvedValueOnce(activeAgent);
    mockConversationCreate.mockResolvedValueOnce({ id: "c1", title: "Office Hours" });

    const result = await service.createConversation("p1", "a1");
    expect(result.id).toBe("c1");
    expect(mockConversationCreate).toHaveBeenCalled();
  });

  it("rejects conversation for suspended agent", async () => {
    mockAgentFind.mockResolvedValueOnce({
      ...activeAgent,
      workforceStatus: "SUSPENDED",
      isActive: false,
    });

    await expect(service.createConversation("p1", "a1")).rejects.toThrow(GovernanceError);
  });

  it("sendFounderMessage saves founder and agent messages", async () => {
    mockAgentFind.mockResolvedValueOnce(activeAgent);
    mockConversationFind.mockResolvedValueOnce({
      id: "c1",
      projectId: "p1",
      agentId: "a1",
      agent: activeAgent,
      project: { id: "p1", name: "Core", description: "OS", workspaceId: "w1", workspace: { id: "w1" } },
      messages: [],
    });
    mockMessageCreate
      .mockResolvedValueOnce({ id: "m1", role: "founder", content: "Hello", createdAt: new Date(), tokenInput: null, tokenOutput: null, tokenTotal: null, provider: null, model: null, fallbackUsed: false })
      .mockResolvedValueOnce({
        id: "m2",
        role: "agent",
        content: "Prioritize debate integrity and modular services this week.",
        createdAt: new Date(),
        tokenInput: 50,
        tokenOutput: 70,
        tokenTotal: 120,
        provider: "mock",
        model: "mock-v1",
        fallbackUsed: false,
      });

    const result = await service.sendFounderMessage("c1", "What should we prioritize?");
    expect(result.founderMessage).toBe("What should we prioritize?");
    expect(result.agentMessage.content).toContain("Prioritize");
    expect(mockMessageCreate).toHaveBeenCalledTimes(2);
  });

  it("creates formal discussion from agent message", async () => {
    mockConversationFind.mockResolvedValueOnce({
      id: "c1",
      projectId: "p1",
      agent: activeAgent,
      messages: [
        { id: "m1", role: "founder", content: "Risks?" },
        { id: "m2", role: "agent", content: "Governance bypass risk if Office Hours mistaken for approval." },
      ],
    });
    mockDiscussionCreate.mockResolvedValueOnce({ id: "d1" });

    const discussion = await service.createFormalDiscussion({
      conversationId: "c1",
      messageId: "m2",
    });

    expect(discussion.id).toBe("d1");
    expect(mockDiscussionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: "p1",
        mode: "normal",
        userPrompt: expect.stringContaining("Governance bypass risk"),
      })
    );
  });
});
