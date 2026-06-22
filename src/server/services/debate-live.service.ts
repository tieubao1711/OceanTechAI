import { prisma } from "@/server/db/prisma";
import { DEBATE_ROUNDS } from "@/types/debate";
import { parseConsensusResult } from "@/server/contracts/consensus.contract";
import { debateParticipantService } from "@/server/workforce/debate-participant.service";
import type { DebateProgress } from "./debate-progress.service";

export type LiveAgentMessage = {
  id: string;
  agentId: string;
  agentName: string;
  agentRole: string;
  stance: string;
  content: string;
  concerns: string[];
  suggestions: string[];
  vote: string | null;
  qualityScore: number | null;
  provider: string | null;
  model: string | null;
  tokenTotal: number | null;
  fallbackUsed: boolean;
  createdAt: string;
};

export type LiveRound = {
  roundNumber: number;
  roundType: string;
  status: "pending" | "running" | "completed";
  messageCount: number;
  messages: LiveAgentMessage[];
  thinkingCount: number;
};

export type DebateLiveState = DebateProgress & {
  projectId: string;
  participantCount: number;
  rounds: LiveRound[];
  consensus: {
    title: string;
    finalDecision: string;
    voteSummary: { yes: number; no: number; abstain: number; classification: string };
    risks: string[];
  } | null;
  proposal: { id: string; status: string; qualityScore: number | null } | null;
};

export class DebateLiveService {
  async getLiveState(discussionId: string): Promise<DebateLiveState> {
    const discussion = await prisma.discussion.findUniqueOrThrow({
      where: { id: discussionId },
      select: {
        id: true,
        projectId: true,
        status: true,
        lastError: true,
        userPrompt: true,
        consensusJson: true,
        rounds: {
          orderBy: { roundNumber: "asc" },
          include: {
            messages: {
              orderBy: { createdAt: "asc" },
              include: {
                agent: { select: { id: true, name: true, role: true } },
              },
            },
          },
        },
        proposal: { select: { id: true, status: true, qualityScore: true } },
      },
    });

    const participants = await debateParticipantService.getParticipantsForDebate({
      projectId: discussion.projectId,
      topic: discussion.userPrompt,
    });
    const participantCount = participants.length;

    const roundMap = new Map(discussion.rounds.map((r) => [r.roundNumber, r]));
    const debateRounds = DEBATE_ROUNDS.filter((r) => r.roundType !== "CONSENSUS");
    const firstFourDone = debateRounds.every((def) => {
      const row = roundMap.get(def.roundNumber);
      return row?.status === "COMPLETED";
    });

    let currentRound: number | null = null;
    const rounds: LiveRound[] = DEBATE_ROUNDS.map((def) => {
      const row = roundMap.get(def.roundNumber);
      const messages: LiveAgentMessage[] = (row?.messages ?? []).map((msg) => ({
        id: msg.id,
        agentId: msg.agent.id,
        agentName: msg.agent.name,
        agentRole: msg.agent.role,
        stance: msg.stance,
        content: msg.content,
        concerns: msg.concerns,
        suggestions: msg.suggestions,
        vote: msg.vote,
        qualityScore: msg.qualityScore,
        provider: msg.provider,
        model: msg.model,
        tokenTotal: msg.tokenTotal,
        fallbackUsed: msg.fallbackUsed,
        createdAt: msg.createdAt.toISOString(),
      }));

      let status: LiveRound["status"] = "pending";
      if (row?.status === "COMPLETED") status = "completed";
      else if (row?.status === "RUNNING") {
        status = "running";
        currentRound = def.roundNumber;
      } else if (
        def.roundNumber === 5 &&
        discussion.status === "RUNNING" &&
        firstFourDone
      ) {
        status = "running";
        currentRound = 5;
      }

      const thinkingCount =
        status === "running" && def.roundType !== "CONSENSUS"
          ? Math.max(0, participantCount - messages.length)
          : 0;

      return {
        roundNumber: def.roundNumber,
        roundType: def.roundType,
        status,
        messageCount: messages.length,
        messages,
        thinkingCount,
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
      phase = firstFourDone && currentRound === 5 ? "finalizing" : "debating";
    }

    const consensus = discussion.consensusJson
      ? (() => {
          const parsed = parseConsensusResult(discussion.consensusJson);
          return {
            title: parsed.title,
            finalDecision: parsed.finalDecision,
            voteSummary: parsed.voteSummary,
            risks: parsed.risks,
          };
        })()
      : null;

    return {
      projectId: discussion.projectId,
      discussionStatus: discussion.status,
      lastError: discussion.lastError,
      rounds,
      currentRound,
      overallPercent,
      phase,
      participantCount,
      consensus,
      proposal: discussion.proposal,
    };
  }
}

export const debateLiveService = new DebateLiveService();
