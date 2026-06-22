import type { Agent, AgentMessage, DiscussionRound } from "@prisma/client";
import type { ConsensusResult } from "@/types/consensus";
import { parseConsensusResult } from "@/server/contracts/consensus.contract";
import { assertVotingRoundBeforeConsensus } from "@/server/invariants/debate-invariants";
import { votingService } from "@/server/governance/voting.service";
import { extractFeatureSlug } from "@/lib/utils";

type MessageWithAgent = AgentMessage & { agent: Agent };
type RoundWithMessages = DiscussionRound & { messages: MessageWithAgent[] };

export class ConsensusEngine {
  aggregate(params: {
    userPrompt: string;
    rounds: RoundWithMessages[];
  }): ConsensusResult {
    assertVotingRoundBeforeConsensus(params.rounds);

    const round1 = params.rounds.find((r) => r.roundNumber === 1);
    const round2 = params.rounds.find((r) => r.roundNumber === 2);
    const round3 = params.rounds.find((r) => r.roundNumber === 3);
    const round4 = params.rounds.find((r) => r.roundNumber === 4);

    const voteMessages = round4?.messages ?? [];
    const voteSummary = votingService.calculateVoteSummary(voteMessages);

    const refineContents = (round3?.messages ?? []).map((m) => m.content);
    const finalDecision =
      refineContents[0] ??
      `Proceed with MVP implementation for: ${params.userPrompt}`;

    const alternativesConsidered = (round1?.messages ?? [])
      .map((m) => `${m.agent.name}: ${m.content.slice(0, 200)}`)
      .filter((_, i) => i > 0);

    const reasons = [
      ...(round3?.messages ?? []).flatMap((m) => m.suggestions).slice(0, 5),
      ...(round4?.messages ?? [])
        .filter((m) => m.vote === "YES")
        .map((m) => m.content.slice(0, 150)),
    ];

    const risks = [
      ...(round2?.messages ?? []).flatMap((m) => m.concerns),
      ...(round3?.messages ?? []).flatMap((m) => m.concerns),
      ...(voteSummary.redTeamDissent
        ? ["Red Team raised security/abuse concerns — review before approval"]
        : []),
    ].slice(0, 10);

    const openQuestions = (round4?.messages ?? [])
      .filter((m) => m.vote === "ABSTAIN")
      .map((m) => `${m.agent.name}: ${m.concerns[0] ?? "Needs more context"}`);

    const title = params.userPrompt.slice(0, 80) || "Feature Proposal";

    const result: ConsensusResult = {
      title,
      finalDecision,
      alternativesConsidered,
      reasons: [...new Set(reasons)].slice(0, 8),
      risks: [...new Set(risks)],
      openQuestions,
      voteSummary,
    };

    return parseConsensusResult(result) as ConsensusResult;
  }

  slugFromConsensus(consensus: ConsensusResult): string {
    return extractFeatureSlug(consensus.title);
  }
}

export const consensusEngine = new ConsensusEngine();
