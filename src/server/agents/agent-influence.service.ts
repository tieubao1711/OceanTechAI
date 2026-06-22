export type InfluenceInput = {
  acceptedCount: number;
  rejectedCount: number;
  proposalCount: number;
  reputationScore: number;
  verifiedImprovements?: number;
  warningJournalCount?: number;
};

export class AgentInfluenceService {
  calculateScore(input: InfluenceInput): number {
    const {
      acceptedCount,
      rejectedCount,
      proposalCount,
      reputationScore,
      verifiedImprovements = 0,
      warningJournalCount = 0,
    } = input;

    const participation = Math.min(proposalCount * 6, 30);
    const acceptance = Math.min(acceptedCount * 8, 32);
    const rejectionPenalty = Math.min(rejectedCount * 4, 16);
    const reputationComponent = Math.min(reputationScore * 4, 40);
    const improvementBonus = Math.min(verifiedImprovements * 5, 15);
    const riskBonus = Math.min(warningJournalCount * 2, 8);

    const raw =
      participation +
      acceptance -
      rejectionPenalty +
      reputationComponent +
      improvementBonus +
      riskBonus;

    return Math.max(0, Math.min(100, Math.round(raw)));
  }
}

export const agentInfluenceService = new AgentInfluenceService();
