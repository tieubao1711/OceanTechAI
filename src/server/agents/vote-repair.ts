import type { RoundType } from "@prisma/client";
import type { AgentMessageContractType } from "@/server/contracts/agent-message.contract";
import type { StanceLiteral, VoteLiteral } from "@/types/agent-message";

export const VOTE_REPAIR_CONCERN =
  "Vote was auto-repaired because model omitted vote field.";

export const VOTE_REPAIR_SUGGESTION =
  "Improve Round 4 prompt to require explicit vote.";

export const VOTE_REPAIR_QUALITY_PENALTY = 40;

export function buildVoteRetryPrompt(): string {
  return [
    "Your previous answer failed because Round 4 requires an explicit vote.",
    'Return valid JSON with vote: "yes", "no", or "abstain".',
    "Do not omit vote.",
  ].join("\n");
}

export function inferVoteFromStance(stance: StanceLiteral): VoteLiteral {
  if (stance === "support" || stance === "refine") return "yes";
  if (stance === "oppose") return "no";
  return "abstain";
}

export function repairMissingVote(
  message: AgentMessageContractType,
  roundType: RoundType
): AgentMessageContractType {
  if (roundType !== "VOTE") return message;
  if (message.vote) return message;

  const vote = inferVoteFromStance(message.stance);

  return {
    ...message,
    vote,
    concerns: message.concerns.includes(VOTE_REPAIR_CONCERN)
      ? message.concerns
      : [...message.concerns, VOTE_REPAIR_CONCERN],
    suggestions: message.suggestions.includes(VOTE_REPAIR_SUGGESTION)
      ? message.suggestions
      : [...message.suggestions, VOTE_REPAIR_SUGGESTION],
  };
}
