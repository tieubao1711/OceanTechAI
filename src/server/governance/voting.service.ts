import type { Agent, AgentMessage, VoteValue } from "@prisma/client";
import type { DissentingAgent, VoteSummary } from "@/types/consensus";
import { assertCanGenerateFiles } from "@/server/invariants/proposal-invariants";
import { classifyVote } from "./decision-classifier";

type VoteMessage = AgentMessage & { agent: Agent };

function toVoteLiteral(vote: VoteValue | null | undefined): "yes" | "no" | "abstain" | null {
  if (!vote) return null;
  return vote.toLowerCase() as "yes" | "no" | "abstain";
}

export class VotingService {
  calculateVoteSummary(voteMessages: VoteMessage[]): VoteSummary {
    let weightedYes = 0;
    let weightedNo = 0;
    let weightedAbstain = 0;
    let rawYes = 0;
    let rawNo = 0;
    let rawAbstain = 0;
    let redTeamVotedNo = false;

    const dissenting: DissentingAgent[] = [];

    for (const msg of voteMessages) {
      const weight = msg.votingWeightSnapshot ?? msg.agent.votingWeight;
      const vote = toVoteLiteral(msg.vote);

      if (!vote) continue;

      if (vote === "yes") {
        weightedYes += weight;
        rawYes += 1;
      } else if (vote === "no") {
        weightedNo += weight;
        rawNo += 1;
        if (msg.agent.role === "red_team") redTeamVotedNo = true;
        dissenting.push({
          agentId: msg.agent.id,
          agentName: msg.agent.name,
          role: msg.agent.role,
          vote: "no",
          keyConcern: msg.concerns[0] ?? msg.content.slice(0, 120),
        });
      } else {
        weightedAbstain += weight;
        rawAbstain += 1;
        dissenting.push({
          agentId: msg.agent.id,
          agentName: msg.agent.name,
          role: msg.agent.role,
          vote: "abstain",
          keyConcern: msg.concerns[0] ?? "Insufficient context",
        });
      }
    }

    const total = weightedYes + weightedNo + weightedAbstain;
    const approvalRatio = total > 0 ? weightedYes / total : 0;
    const rejectionRatio = total > 0 ? weightedNo / total : 0;

    const classification = classifyVote({
      approvalRatio,
      rejectionRatio,
      redTeamVotedNo,
    });

    return {
      yes: weightedYes,
      no: weightedNo,
      abstain: weightedAbstain,
      raw: { yes: rawYes, no: rawNo, abstain: rawAbstain },
      classification,
      dissenting,
      redTeamDissent: redTeamVotedNo,
    };
  }

  assertCanGenerateFiles(proposalStatus: string): void {
    assertCanGenerateFiles(proposalStatus);
  }
}

export const votingService = new VotingService();
