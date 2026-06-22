import { describe, it, expect, vi, beforeEach } from "vitest";
import { DebateLiveService } from "@/server/services/debate-live.service";

const mockFindUniqueOrThrow = vi.fn();
const mockGetParticipants = vi.fn();

vi.mock("@/server/db/prisma", () => ({
  prisma: {
    discussion: {
      findUniqueOrThrow: (...args: unknown[]) => mockFindUniqueOrThrow(...args),
    },
  },
}));

vi.mock("@/server/workforce/debate-participant.service", () => ({
  debateParticipantService: {
    getParticipantsForDebate: (...args: unknown[]) => mockGetParticipants(...args),
  },
}));

describe("debate-live.service", () => {
  const service = new DebateLiveService();

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetParticipants.mockResolvedValue([{ id: "a1" }, { id: "a2" }, { id: "a3" }]);
  });

  it("returns live messages and thinking count for active round", async () => {
    mockFindUniqueOrThrow.mockResolvedValueOnce({
      id: "d1",
      projectId: "p1",
      status: "RUNNING",
      lastError: null,
      userPrompt: "Architecture review",
      consensusJson: null,
      proposal: null,
      rounds: [
        {
          roundNumber: 1,
          roundType: "PROPOSE",
          status: "RUNNING",
          messages: [
            {
              id: "m1",
              stance: "SUPPORT",
              content: "Use modular services.",
              concerns: [],
              suggestions: [],
              vote: null,
              qualityScore: 80,
              provider: "mock",
              model: "mock-v1",
              tokenTotal: 50,
              fallbackUsed: false,
              createdAt: new Date("2026-06-01T12:00:00Z"),
              agent: { id: "a1", name: "Sam", role: "system_architect" },
            },
          ],
        },
      ],
    });

    const state = await service.getLiveState("d1");

    expect(state.rounds[0]?.messages).toHaveLength(1);
    expect(state.rounds[0]?.thinkingCount).toBe(2);
    expect(state.phase).toBe("debating");
  });
});
