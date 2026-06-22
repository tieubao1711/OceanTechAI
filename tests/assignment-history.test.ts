import { describe, it, expect, vi, beforeEach } from "vitest";
import { AssignmentHistoryService } from "@/server/workforce/assignment-history.service";

const mockCreate = vi.fn();
const mockFindMany = vi.fn();

vi.mock("@/server/db/prisma", () => ({
  prisma: {
    projectAssignmentEvent: {
      create: (...args: unknown[]) => mockCreate(...args),
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
  },
}));

describe("assignment-history", () => {
  const service = new AssignmentHistoryService();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("records assignment events", async () => {
    mockCreate.mockResolvedValueOnce({ id: "e1" });

    await service.record({
      projectId: "p1",
      agentId: "a1",
      type: "ASSIGNED",
      message: "Sam assigned as Architect (100%)",
    });

    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        projectId: "p1",
        agentId: "a1",
        type: "ASSIGNED",
        message: "Sam assigned as Architect (100%)",
      },
    });
  });

  it("lists recent events for a project", async () => {
    const createdAt = new Date("2026-06-01T12:00:00Z");
    mockFindMany.mockResolvedValueOnce([
      {
        id: "e1",
        agentId: "a1",
        type: "REMOVED",
        message: "Sam removed from project",
        createdAt,
      },
    ]);

    const events = await service.listByProject("p1");

    expect(events).toEqual([
      {
        id: "e1",
        agentId: "a1",
        type: "REMOVED",
        message: "Sam removed from project",
        createdAt,
      },
    ]);
    expect(mockFindMany).toHaveBeenCalledWith({
      where: { projectId: "p1" },
      orderBy: { createdAt: "desc" },
      take: 15,
    });
  });
});
