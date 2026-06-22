import { describe, it, expect, vi, beforeEach } from "vitest";
import { DebtStatus } from "@/server/learning/learning-types";
import { TopicLifecycleService } from "@/server/learning/integrity/topic-lifecycle.service";

const mockDebtFindMany = vi.fn();
const mockCycleFindMany = vi.fn();
const mockMemoryFindMany = vi.fn();
const mockAdrFindMany = vi.fn();

vi.mock("@/server/db/prisma", () => ({
  prisma: {
    memoryEntry: {
      findMany: (args: { where?: { key?: { startsWith?: string } } }) => {
        if (args?.where?.key?.startsWith === "debt_track_") {
          return mockDebtFindMany(args);
        }
        return mockMemoryFindMany(args);
      },
    },
    improvementCycle: { findMany: (...args: unknown[]) => mockCycleFindMany(...args) },
    adr: { findMany: (...args: unknown[]) => mockAdrFindMany(...args) },
  },
}));

describe("topic-lifecycle.service", () => {
  const service = new TopicLifecycleService();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("prioritizes REOPENED over VERIFIED for the same canonical topic", async () => {
    mockDebtFindMany.mockResolvedValueOnce([
      {
        value: JSON.stringify({
          title: "Reputation not used in voting",
          status: DebtStatus.REOPENED,
          topicKey: "agent_reputation_voting",
          occurrenceCount: 2,
          lastSeenAt: "2026-06-12",
        }),
      },
    ]);
    mockCycleFindMany.mockResolvedValueOnce([
      {
        id: "cycle-1",
        title: "Reputation not used in voting",
        status: "VERIFIED",
        topicKey: "agent_reputation_voting",
      },
    ]);
    mockMemoryFindMany.mockResolvedValueOnce([]);
    mockAdrFindMany.mockResolvedValueOnce([]);

    const lifecycle = await service.resolve("proj-1", "Implement Agent Reputation");

    expect(lifecycle.topicKey).toBe("agent_reputation_voting");
    expect(lifecycle.status).toBe("REOPENED");
  });

  it("returns VERIFIED for verified improvement cycle topics", async () => {
    mockDebtFindMany.mockResolvedValueOnce([]);
    mockCycleFindMany.mockResolvedValueOnce([
      {
        id: "cycle-2",
        title: "Execution retry gaps",
        status: "VERIFIED",
        topicKey: "execution_retry_gaps",
      },
    ]);
    mockMemoryFindMany.mockResolvedValueOnce([]);
    mockAdrFindMany.mockResolvedValueOnce([]);

    const lifecycle = await service.resolve("proj-1", "GitHub execution retry");

    expect(lifecycle.topicKey).toBe("execution_retry_gaps");
    expect(lifecycle.status).toBe("VERIFIED");
  });

  it("skips closed topics for recommendations", async () => {
    mockDebtFindMany.mockResolvedValueOnce([]);
    mockCycleFindMany.mockResolvedValueOnce([
      {
        id: "cycle-3",
        title: "Agent Reputation",
        status: "IMPLEMENTED",
        topicKey: "agent_reputation_voting",
      },
    ]);
    mockMemoryFindMany.mockResolvedValueOnce([]);
    mockAdrFindMany.mockResolvedValueOnce([]);

    const skip = await service.shouldSkipClosedTopic("proj-1", "Implement Agent Reputation");
    expect(skip).toBe(true);
  });
});
