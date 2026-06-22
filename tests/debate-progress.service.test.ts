import { describe, it, expect, vi, beforeEach } from "vitest";
import { DebateProgressService } from "@/server/services/debate-progress.service";

const mockFindUniqueOrThrow = vi.fn();

vi.mock("@/server/db/prisma", () => ({
  prisma: {
    discussion: {
      findUniqueOrThrow: (...args: unknown[]) => mockFindUniqueOrThrow(...args),
    },
  },
}));

describe("debate-progress.service", () => {
  const service = new DebateProgressService();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("marks current round as running and computes percent", async () => {
    mockFindUniqueOrThrow.mockResolvedValueOnce({
      status: "RUNNING",
      lastError: null,
      rounds: [
        {
          roundNumber: 1,
          roundType: "PROPOSE",
          status: "COMPLETED",
          _count: { messages: 5 },
        },
        {
          roundNumber: 2,
          roundType: "CRITIQUE",
          status: "RUNNING",
          _count: { messages: 2 },
        },
      ],
    });

    const progress = await service.getProgress("d1");

    expect(progress.currentRound).toBe(2);
    expect(progress.phase).toBe("debating");
    expect(progress.rounds[0]?.status).toBe("completed");
    expect(progress.rounds[1]?.status).toBe("running");
    expect(progress.overallPercent).toBeGreaterThan(0);
  });

  it("enters finalizing phase after round 4 completes", async () => {
    mockFindUniqueOrThrow.mockResolvedValueOnce({
      status: "RUNNING",
      lastError: null,
      rounds: [1, 2, 3, 4].map((n) => ({
        roundNumber: n,
        roundType: "X",
        status: "COMPLETED",
        _count: { messages: 4 },
      })),
    });

    const progress = await service.getProgress("d1");

    expect(progress.phase).toBe("finalizing");
    expect(progress.currentRound).toBe(5);
    expect(progress.rounds[4]?.status).toBe("running");
  });
});
