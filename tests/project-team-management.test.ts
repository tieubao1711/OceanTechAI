import { describe, it, expect, vi, beforeEach } from "vitest";
import { ProjectTeamService } from "@/server/workforce/project-team.service";

const mockProjectFind = vi.fn();
const mockAssignmentFindMany = vi.fn();
const mockAssignmentFindUnique = vi.fn();
const mockAssignmentDelete = vi.fn();
const mockAssignmentUpdateMany = vi.fn();
const mockAssignmentUpdate = vi.fn();
const mockAgentFind = vi.fn();
const mockAgentFindMany = vi.fn();
const mockAssign = vi.fn();
const mockRecord = vi.fn();
const mockListEvents = vi.fn();
const mockBuildCouncilMember = vi.fn();
const mockGetCapacity = vi.fn();

vi.mock("@/server/db/prisma", () => ({
  prisma: {
    project: { findUniqueOrThrow: (...args: unknown[]) => mockProjectFind(...args) },
    projectAssignment: {
      findMany: (...args: unknown[]) => mockAssignmentFindMany(...args),
      findUnique: (...args: unknown[]) => mockAssignmentFindUnique(...args),
      findUniqueOrThrow: (...args: unknown[]) => mockAssignmentFindUnique(...args),
      delete: (...args: unknown[]) => mockAssignmentDelete(...args),
      updateMany: (...args: unknown[]) => mockAssignmentUpdateMany(...args),
      update: (...args: unknown[]) => mockAssignmentUpdate(...args),
    },
    agent: {
      findUniqueOrThrow: (...args: unknown[]) => mockAgentFind(...args),
      findMany: (...args: unknown[]) => mockAgentFindMany(...args),
    },
  },
}));

vi.mock("@/server/workforce/project-assignment.service", () => ({
  projectAssignmentService: {
    assign: (...args: unknown[]) => mockAssign(...args),
    getAgentCapacity: (...args: unknown[]) => mockGetCapacity(...args),
  },
}));

vi.mock("@/server/workforce/assignment-history.service", () => ({
  assignmentHistoryService: {
    record: (...args: unknown[]) => mockRecord(...args),
    listByProject: (...args: unknown[]) => mockListEvents(...args),
  },
}));

vi.mock("@/server/agents/agent-identity.service", () => ({
  agentIdentityService: {
    buildCouncilMember: (...args: unknown[]) => mockBuildCouncilMember(...args),
  },
}));

vi.mock("@/server/founder/founder-context", () => ({
  getFounderScope: vi.fn().mockResolvedValue({ projectIds: ["p1"], workspaceIds: ["w1"] }),
}));

describe("project-team-management", () => {
  const service = new ProjectTeamService();

  const baseAgent = {
    id: "a1",
    projectId: "p1",
    name: "Sam — Architect",
    title: "Lead Architect",
    department: "ENGINEERING",
    role: "system_architect",
    avatarSeed: "sam",
    avatarType: "FANTASY",
    workforceStatus: "ACTIVE",
    isActive: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockBuildCouncilMember.mockResolvedValue({
      title: "Lead Architect",
      status: "active",
      reputation: 4.5,
      influenceScore: 80,
    });
    mockGetCapacity.mockResolvedValue({ isOverallocated: false, totalAllocation: 100 });
    mockListEvents.mockResolvedValue([]);
    mockAgentFindMany.mockResolvedValue([]);
  });

  it("adds agent to project and records history", async () => {
    mockAgentFind.mockResolvedValueOnce(baseAgent);
    mockAssign.mockResolvedValueOnce({ id: "as1" });
    mockRecord.mockResolvedValueOnce({ id: "e1" });

    await service.addAgentToProject({
      projectId: "p1",
      agentId: "a1",
      role: "Lead Architect",
      allocationPercent: 100,
      isLead: true,
    });

    expect(mockAssign).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: "p1",
        agentId: "a1",
        role: "Lead Architect",
        assignedBy: "founder",
      })
    );
    expect(mockRecord).toHaveBeenCalledWith(
      expect.objectContaining({ type: "ASSIGNED", projectId: "p1", agentId: "a1" })
    );
  });

  it("removes assignment without deleting agent", async () => {
    mockAssignmentFindUnique.mockResolvedValueOnce({
      id: "as1",
      agent: { name: "Sam — Architect" },
    });
    mockAssignmentDelete.mockResolvedValueOnce({ id: "as1" });

    await service.removeFromProject("p1", "a1");

    expect(mockAssignmentDelete).toHaveBeenCalledWith({
      where: { projectId_agentId: { projectId: "p1", agentId: "a1" } },
    });
    expect(mockRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "REMOVED",
        message: expect.stringContaining("agent retained"),
      })
    );
  });

  it("sets project lead and clears other leads", async () => {
    mockAssignmentUpdateMany.mockResolvedValueOnce({ count: 2 });
    mockAssignmentUpdate.mockResolvedValueOnce({ id: "as1", isLead: true });
    mockAgentFind.mockResolvedValueOnce(baseAgent);

    await service.setLead("p1", "a1");

    expect(mockAssignmentUpdateMany).toHaveBeenCalledWith({
      where: { projectId: "p1" },
      data: { isLead: false },
    });
    expect(mockRecord).toHaveBeenCalledWith(
      expect.objectContaining({ type: "LEAD_CHANGED" })
    );
  });

  it("includes overallocated warning in team page data", async () => {
    mockProjectFind.mockResolvedValueOnce({
      id: "p1",
      name: "OceanTechAI Core",
      description: "Core platform",
      workspaceId: "w1",
    });
    mockAssignmentFindMany.mockResolvedValueOnce([
      {
        id: "as1",
        role: "system_architect",
        allocationPercent: 100,
        isLead: true,
        agent: baseAgent,
      },
    ]);
    mockGetCapacity.mockResolvedValueOnce({ isOverallocated: true, totalAllocation: 120 });

    const page = await service.getTeamPage("p1");

    expect(page.members[0]?.isOverallocated).toBe(true);
    expect(page.warnings.some((w) => w.includes("overallocated"))).toBe(true);
  });
});
