import { describe, it, expect, vi, beforeEach } from "vitest";
import { ProjectAssignmentService } from "@/server/workforce/project-assignment.service";

const mockFindMany = vi.fn();
const mockUpsert = vi.fn();
const mockFindUniqueOrThrow = vi.fn();

vi.mock("@/server/db/prisma", () => ({
  prisma: {
    projectAssignment: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      upsert: (...args: unknown[]) => mockUpsert(...args),
    },
    project: {
      findUniqueOrThrow: (...args: unknown[]) => mockFindUniqueOrThrow(...args),
    },
    agent: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}));

describe("project-assignment", () => {
  const service = new ProjectAssignmentService();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws when assignment would exceed 100% capacity", async () => {
    mockFindMany.mockResolvedValueOnce([
      { projectId: "p1", allocationPercent: 80 },
    ]);

    await expect(
      service.assign({
        projectId: "p2",
        agentId: "a1",
        role: "Advisor",
        allocationPercent: 30,
      })
    ).rejects.toThrow("100%");
  });

  it("upserts assignment when capacity is valid", async () => {
    mockFindMany.mockResolvedValueOnce([
      { projectId: "p1", allocationPercent: 70 },
    ]);
    mockUpsert.mockResolvedValueOnce({ id: "as1" });

    const result = await service.assign({
      projectId: "p2",
      agentId: "a1",
      role: "Technical Advisor",
      allocationPercent: 30,
      isLead: false,
    });

    expect(result).toEqual({ id: "as1" });
    expect(mockUpsert).toHaveBeenCalled();
  });

  it("builds project team with leads and members", async () => {
    mockFindUniqueOrThrow.mockResolvedValueOnce({ id: "p1", name: "Core" });
    mockFindMany.mockResolvedValueOnce([
      {
        id: "as1",
        projectId: "p1",
        agentId: "a1",
        role: "Lead Architect",
        allocationPercent: 100,
        isLead: true,
        assignedAt: new Date(),
        assignedBy: "seed",
        project: { name: "Core" },
        agent: { name: "Sam" },
      },
      {
        id: "as2",
        projectId: "p1",
        agentId: "a2",
        role: "QA",
        allocationPercent: 100,
        isLead: false,
        assignedAt: new Date(),
        assignedBy: "seed",
        project: { name: "Core" },
        agent: { name: "Jordan" },
      },
    ]);

    const team = await service.getProjectTeam("p1");
    expect(team.leads).toHaveLength(1);
    expect(team.members).toHaveLength(1);
    expect(team.leads[0]?.agentName).toBe("Sam");
  });
});
