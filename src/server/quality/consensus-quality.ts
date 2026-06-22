import type { ConsensusResult } from "@/types/consensus";
import { GovernanceError } from "@/server/errors/governance-error";

export const CONSENSUS_QUALITY_THRESHOLD = 70;

export function scoreConsensus(consensus: ConsensusResult): number {
  let score = 0;

  if (consensus.title.trim().length >= 10) score += 10;
  if (consensus.finalDecision.trim().length >= 50) score += 25;
  else if (consensus.finalDecision.trim().length >= 20) score += 10;

  if (consensus.alternativesConsidered.length >= 1) score += 15;
  if (consensus.reasons.length >= 2) score += 15;
  if (consensus.risks.length >= 1) score += 15;

  if (consensus.voteSummary) {
    const total =
      consensus.voteSummary.yes +
      consensus.voteSummary.no +
      consensus.voteSummary.abstain;
    if (total > 0) score += 10;
    if (consensus.voteSummary.classification) score += 10;
  }

  return Math.min(100, score);
}

export function assertConsensusQuality(consensus: ConsensusResult): number {
  const score = scoreConsensus(consensus);
  if (score < CONSENSUS_QUALITY_THRESHOLD) {
    throw new GovernanceError(
      "CONSENSUS_QUALITY_TOO_LOW",
      `Consensus quality score ${score} is below threshold ${CONSENSUS_QUALITY_THRESHOLD}. Proposal not created.`
    );
  }
  return score;
}
