import type { DecisionAction } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { votingService } from "./voting.service";
import { classifyDecision } from "./decision-classifier";
import { markdownGenerator } from "@/server/proposals/markdown-generator";
import {
  actionToStatus,
  assertCannotApproveRejected,
  assertValidProposalTransition,
} from "@/server/invariants/governance-invariants";
import {
  assertProposalNotTerminal,
  assertProposalPendingForResolution,
} from "@/server/invariants/proposal-invariants";
import { decisionLearningService } from "@/server/insights/decision-learning.service";

export class GovernanceService {
  async seedWorkspaceRules(workspaceId: string) {
    const rules = [
      {
        ruleType: "PROHIBITION" as const,
        key: "no_auto_execute",
        value: "AI consensus cannot trigger execution without Founder approval.",
      },
      {
        ruleType: "THRESHOLD" as const,
        key: "strong_consensus",
        value: "approval_ratio >= 0.6 AND rejection_ratio < 0.3",
      },
      {
        ruleType: "PREFERENCE" as const,
        key: "founder_veto",
        value: "Founder has sovereign veto on all proposals.",
      },
    ];

    for (const rule of rules) {
      const existing = await prisma.governanceRule.findFirst({
        where: { workspaceId, key: rule.key },
      });
      if (!existing) {
        await prisma.governanceRule.create({
          data: { workspaceId, ...rule },
        });
      }
    }
  }

  async resolveProposal(params: {
    proposalId: string;
    action: DecisionAction;
    decidedBy: string;
    notes?: string;
  }) {
    const proposal = await prisma.proposal.findUniqueOrThrow({
      where: { id: params.proposalId },
      include: { discussion: { include: { project: true } } },
    });

    const targetStatus = actionToStatus(params.action);

    assertCannotApproveRejected(proposal.status, params.action);
    assertProposalNotTerminal(proposal, params.action.toLowerCase());
    assertProposalPendingForResolution(proposal);
    assertValidProposalTransition(proposal.status, targetStatus);

    const updated = await prisma.$transaction(async (tx) => {
      const updatedProposal = await tx.proposal.update({
        where: { id: params.proposalId },
        data: { status: targetStatus },
      });

      await tx.decisionLog.create({
        data: {
          proposalId: params.proposalId,
          action: params.action,
          decidedBy: params.decidedBy,
          notes: params.notes,
        },
      });

      if (params.action === "APPROVED") {
        votingService.assertCanGenerateFiles("APPROVED");
        await markdownGenerator.generate(tx, updatedProposal);
      }

      if (params.action === "CHANGES_REQUESTED" || params.action === "REJECTED") {
        await tx.memoryEntry.create({
          data: {
            scope: "DECISION",
            projectId: proposal.discussion.projectId,
            key: `proposal_${proposal.id}_${params.action.toLowerCase()}`,
            value: params.notes ?? `Proposal ${params.action.toLowerCase()}`,
            source: "founder_decision",
          },
        });
      }

      return updatedProposal;
    });

    await decisionLearningService.recordOutcome(
      params.proposalId,
      params.action,
      params.notes
    );

    return updated;
  }

  getDecisionClassForPrompt(userPrompt: string) {
    return classifyDecision(userPrompt);
  }
}

export const governanceService = new GovernanceService();
