import { prisma } from "@/server/db/prisma";
import { DEBATE_ROUNDS } from "@/types/debate";

export type DebateRoundProgress = {
  roundNumber: number;
  roundType: string;
  status: "pending" | "running" | "completed";
  messageCount: number;
};

export type DebateProgress = {
  discussionStatus: string;
  lastError: string | null;
  rounds: DebateRoundProgress[];
  currentRound: number | null;
  overallPercent: number;
  phase: "idle" | "debating" | "finalizing" | "completed" | "failed";
};

export class DebateProgressService {
  async getProgress(discussionId: string): Promise<DebateProgress> {
    const discussion = await prisma.discussion.findUniqueOrThrow({
      where: { id: discussionId },
      select: {
        status: true,
        lastError: true,
        rounds: {
          orderBy: { roundNumber: "asc" },
          select: {
            roundNumber: true,
            roundType: true,
            status: true,
            _count: { select: { messages: true } },
          },
        },
      },
    });

    const roundMap = new Map(discussion.rounds.map((r) => [r.roundNumber, r]));
    const debateRounds = DEBATE_ROUNDS.filter((r) => r.roundType !== "CONSENSUS");
    const firstFourDone = debateRounds.every((def) => {
      const row = roundMap.get(def.roundNumber);
      return row?.status === "COMPLETED";
    });

    let currentRound: number | null = null;
    const rounds: DebateRoundProgress[] = DEBATE_ROUNDS.map((def) => {
      const row = roundMap.get(def.roundNumber);

      if (row?.status === "COMPLETED") {
        return {
          roundNumber: def.roundNumber,
          roundType: def.roundType,
          status: "completed" as const,
          messageCount: row._count.messages,
        };
      }

      if (row?.status === "RUNNING") {
        currentRound = def.roundNumber;
        return {
          roundNumber: def.roundNumber,
          roundType: def.roundType,
          status: "running" as const,
          messageCount: row._count.messages,
        };
      }

      if (
        def.roundNumber === 5 &&
        discussion.status === "RUNNING" &&
        firstFourDone
      ) {
        currentRound = 5;
        return {
          roundNumber: def.roundNumber,
          roundType: def.roundType,
          status: "running" as const,
          messageCount: row?._count.messages ?? 0,
        };
      }

      return {
        roundNumber: def.roundNumber,
        roundType: def.roundType,
        status: "pending" as const,
        messageCount: row?._count.messages ?? 0,
      };
    });

    const completedCount = rounds.filter((r) => r.status === "completed").length;
    const runningBonus = rounds.some((r) => r.status === "running") ? 0.5 : 0;
    const overallPercent = Math.min(
      100,
      Math.round(((completedCount + runningBonus) / rounds.length) * 100)
    );

    let phase: DebateProgress["phase"] = "idle";
    if (discussion.status === "COMPLETED") phase = "completed";
    else if (discussion.status === "FAILED") phase = "failed";
    else if (discussion.status === "RUNNING") {
      phase =
        firstFourDone && currentRound === 5 ? "finalizing" : "debating";
    }

    return {
      discussionStatus: discussion.status,
      lastError: discussion.lastError,
      rounds,
      currentRound,
      overallPercent,
      phase,
    };
  }
}

export const debateProgressService = new DebateProgressService();
