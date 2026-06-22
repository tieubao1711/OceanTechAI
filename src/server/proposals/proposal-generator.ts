import { prisma } from "@/server/db/prisma";
import type { ConsensusResult } from "@/types/consensus";
import { parseProposalDraft } from "@/server/contracts/proposal.contract";
import { assertDiscussionHasConsensus } from "@/server/invariants/debate-invariants";
import { consensusEngine } from "@/server/debate/consensus-engine";

export class ProposalGenerator {
  async create(
    discussionId: string,
    consensus: ConsensusResult,
    qualityScore?: number
  ) {
    const discussion = await prisma.discussion.findUniqueOrThrow({
      where: { id: discussionId },
    });

    assertDiscussionHasConsensus({
      consensusJson: discussion.consensusJson ?? consensus,
      status: discussion.status,
    });

    const existing = await prisma.proposal.findUnique({
      where: { discussionId },
    });
    if (existing) return existing;

    const slug = consensusEngine.slugFromConsensus(consensus);

    const summary = [
      consensus.finalDecision,
      "",
      `Vote classification: ${consensus.voteSummary.classification}`,
      `Weighted votes — yes: ${consensus.voteSummary.yes}, no: ${consensus.voteSummary.no}, abstain: ${consensus.voteSummary.abstain}`,
      qualityScore != null ? `Consensus quality score: ${qualityScore}/100` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const draft = parseProposalDraft({
      discussionId,
      title: consensus.title,
      summary,
      alternativesConsidered: consensus.alternativesConsidered,
      chosenSolution: consensus.finalDecision,
      reasoning: consensus.reasons,
      risks: consensus.risks,
      filesToCreate: [
        `docs/features/${slug}.md`,
        `docs/architecture/${slug}.md`,
        `docs/api/${slug}.md`,
        `tasks/${slug}.cursor.md`,
      ],
      tasksToCreate: [
        `Implement core feature: ${consensus.title}`,
        "Add API endpoints per architecture doc",
        "Write P0 test cases from QA recommendations",
        "Address Red Team security mitigations",
      ],
      voteClassification: consensus.voteSummary.classification,
      status: "PENDING" as const,
    });

    return prisma.proposal.create({
      data: { ...draft, qualityScore },
    });
  }
}

export const proposalGenerator = new ProposalGenerator();
