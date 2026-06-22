import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  SidebarContextService,
  parseSidebarContext,
} from "@/server/workforce/sidebar-context.service";
import { OfficeHoursService } from "@/server/office-hours/office-hours.service";
import { GovernanceError } from "@/server/errors/governance-error";

const mockAssignmentFindMany = vi.fn();
const mockAgentFindMany = vi.fn();
const mockConversationFindFirst = vi.fn();
const mockAgentFind = vi.fn();
const mockConversationFind = vi.fn();
const mockConversationCreate = vi.fn();
const mockGetGlobalAgents = vi.fn();
const mockDiscussionFindMany = vi.fn();
const mockProjectFindUniqueOrThrow = vi.fn();

vi.mock("@/server/db/prisma", () => ({
  prisma: {
    project: {
      findUniqueOrThrow: (...args: unknown[]) => mockProjectFindUniqueOrThrow(...args),
    },
    projectAssignment: {
      findMany: (...args: unknown[]) => mockAssignmentFindMany(...args),
    },
    agent: {
      findMany: (...args: unknown[]) => mockAgentFindMany(...args),
      findUnique: (...args: unknown[]) => mockAgentFind(...args),
      findUniqueOrThrow: (...args: unknown[]) => mockAgentFind(...args),
      findFirstOrThrow: (...args: unknown[]) => mockAgentFind(...args),
    },
    agentConversation: {
      findFirst: (...args: unknown[]) => mockConversationFindFirst(...args),
      findUniqueOrThrow: (...args: unknown[]) => mockConversationFind(...args),
      create: (...args: unknown[]) => mockConversationCreate(...args),
    },
    discussion: {
      findMany: (...args: unknown[]) => mockDiscussionFindMany(...args),
    },
  },
}));

vi.mock("@/server/founder/founder.service", () => ({
  founderService: {
    getGlobalAgents: (...args: unknown[]) => mockGetGlobalAgents(...args),
  },
}));

vi.mock("@/server/founder/founder-context", () => ({
  getFounderScope: vi.fn().mockResolvedValue({ projectIds: ["p1", "p2"], workspaceIds: ["w1"] }),
}));

vi.mock("@/server/office-hours/office-hours-runner", () => ({
  officeHoursRunner: { run: vi.fn() },
}));

const mockDiscussionCreate = vi.fn();

vi.mock("@/server/services/discussion.service", () => ({
  discussionService: { create: (...args: unknown[]) => mockDiscussionCreate(...args) },
}));

describe("agent-chat-sidebar", () => {
  const sidebarService = new SidebarContextService();
  const officeHoursService = new OfficeHoursService();

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
    avatarSeed: "sam",
    avatarType: "FANTASY",
    memorySummary: "",
    systemPrompt: "",
    expertise: [],
    modelProvider: "mock",
    modelName: "mock-v1",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockConversationFindFirst.mockResolvedValue(null);
    mockProjectFindUniqueOrThrow.mockResolvedValue({ name: "OceanTechAI Core" });
  });

  describe("parseSidebarContext", () => {
    it("detects project page context", () => {
      expect(parseSidebarContext("/projects/oceantechai-core")).toEqual({
        page: "project",
        projectId: "oceantechai-core",
      });
    });

    it("detects learning page context", () => {
      expect(parseSidebarContext("/learning")).toEqual({ page: "learning" });
    });
  });

  describe("sidebar agents", () => {
    it("lists project-assigned agents first on project page", async () => {
      mockAssignmentFindMany.mockResolvedValueOnce([
        {
          isLead: true,
          allocationPercent: 100,
          role: "Lead Architect",
          agent: { ...activeAgent, project: { name: "OceanTechAI Core" } },
        },
        {
          isLead: false,
          allocationPercent: 50,
          role: "QA",
          agent: {
            ...activeAgent,
            id: "a2",
            name: "Quinn — QA",
            role: "qa_engineer",
            department: "QA",
            title: "QA Engineer",
            project: { name: "OceanTechAI Core" },
          },
        },
      ]);

      const agents = await sidebarService.getAgentsForSidebar({
        pathname: "/projects/p1",
      });

      expect(mockAssignmentFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { projectId: "p1" } })
      );
      expect(agents).toHaveLength(2);
      expect(agents[0]?.chatProjectId).toBe("p1");
      expect(agents[0]?.canChat).toBe(true);
    });

    it("marks retired/disabled agents as not chat-able", async () => {
      mockAssignmentFindMany.mockResolvedValueOnce([
        {
          isLead: false,
          allocationPercent: 100,
          role: "Advisor",
          agent: {
            ...activeAgent,
            workforceStatus: "RETIRED",
            isActive: false,
            project: { name: "OceanTechAI Core" },
          },
        },
      ]);

      const agents = await sidebarService.getAgentsForSidebar({
        pathname: "/projects/p1",
      });

      expect(agents[0]?.canChat).toBe(false);
    });

    it("searches agents globally by query", async () => {
      mockGetGlobalAgents.mockResolvedValueOnce([
        {
          id: "a3",
          homeProjectId: "p2",
          homeProjectName: "MMO Game Project",
          name: "Linh — Trưởng sản phẩm Game",
          displayName: "Linh (MMO Game Project)",
          title: "Product Manager",
          departmentLabel: "Product",
          role: "product_manager",
          avatarEmoji: "📋",
          avatarColor: "#f59e0b",
          status: "active",
        },
      ]);

      const agents = await sidebarService.getAgentsForSidebar({
        pathname: "/executive",
        search: "product",
      });

      expect(mockGetGlobalAgents).toHaveBeenCalledWith("product");
      expect(agents[0]?.name).toContain("Linh");
    });
  });

  describe("sidebar office hours", () => {
    it("loads sidebar chat via existing Office Hours service", async () => {
      mockAgentFind.mockResolvedValue(activeAgent);
      mockConversationFindFirst.mockResolvedValueOnce({ id: "c1" });
      mockConversationFind.mockResolvedValueOnce({
        id: "c1",
        projectId: "p1",
        agentId: "a1",
        title: "Office Hours",
        createdAt: new Date(),
        updatedAt: new Date(),
        messages: [],
      });

      const chat = await officeHoursService.loadSidebarChat("p1", "a1");
      expect(chat.id).toBe("c1");
      expect(mockConversationCreate).not.toHaveBeenCalled();
    });

    it("rejects chat for disabled agents", async () => {
      mockAgentFind.mockResolvedValueOnce({
        ...activeAgent,
        workforceStatus: "SUSPENDED",
        isActive: false,
      });

      await expect(officeHoursService.loadSidebarChat("p1", "a1")).rejects.toThrow(
        GovernanceError
      );
    });

    it("creates formal discussion from sidebar agent message", async () => {
      mockConversationFind.mockImplementation(async (args: { where: { id: string } }) => {
        if (args.where.id !== "c1") throw new Error("Conversation not found");
        return {
          id: "c1",
          projectId: "p1",
          agent: activeAgent,
          messages: [
            { id: "m1", role: "founder", content: "Quick question?" },
            { id: "m2", role: "agent", content: "Recommend a modular debate pipeline." },
          ],
        };
      });
      mockDiscussionCreate.mockResolvedValueOnce({ id: "d1" });

      const discussion = await officeHoursService.createFormalDiscussion({
        conversationId: "c1",
        messageId: "m2",
      });

      expect(discussion.id).toBe("d1");
      expect(mockDiscussionCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: "p1",
          userPrompt: expect.stringContaining("modular debate"),
        })
      );
    });
  });
});
