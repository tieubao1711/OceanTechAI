import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest";
import { prisma } from "@/server/db/prisma";
import { debateOrchestrator } from "@/server/debate/debate-orchestrator";
import { discussionService } from "@/server/services/discussion.service";

const HAS_DB = !!process.env.DATABASE_URL;

describe.skipIf(!HAS_DB)("DebateOrchestrator (integration)", () => {
  let projectId: string;

  beforeEach(() => {
    vi.stubEnv("AI_PROVIDER_MODE", "mock");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  beforeAll(async () => {
    const seedProject = await prisma.project.findUnique({
      where: { id: "seed-project" },
    });

    if (!seedProject) {
      throw new Error("Seed project missing. Run: npm run db:seed");
    }
    projectId = seedProject.id;
  });

  it("creates 5 rounds with messages and a pending proposal", async () => {
    const discussion = await discussionService.create({
      projectId,
      userPrompt: "Test debate orchestrator — add inventory sync feature.",
    });

    await debateOrchestrator.run(discussion.id);

    const full = await discussionService.getById(discussion.id);
    expect(full.status).toBe("COMPLETED");
    expect(full.rounds).toHaveLength(5);

    const round1 = full.rounds.find((r) => r.roundNumber === 1)!;
    expect(round1.messages.length).toBeGreaterThan(0);

    const round4 = full.rounds.find((r) => r.roundNumber === 4)!;
    expect(round4.roundType).toBe("VOTE");

    const votes = await prisma.voteRecord.findMany({
      where: { discussionId: discussion.id },
    });
    expect(votes.length).toBeGreaterThan(0);

    expect(full.consensusJson).toBeTruthy();
    expect(full.proposal).toBeTruthy();
    expect(full.proposal!.status).toBe("PENDING");
  });
});
