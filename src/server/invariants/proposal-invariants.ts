import type { Proposal, ProposalStatus } from "@prisma/client";
import { GovernanceError } from "@/server/errors/governance-error";

export function assertProposalPendingForResolution(
  proposal: Pick<Proposal, "status">
): void {
  if (proposal.status !== "PENDING") {
    throw new GovernanceError(
      "PROPOSAL_NOT_RESOLVABLE",
      `Proposal with status "${proposal.status}" cannot be approved, rejected, or changed.`
    );
  }
}

export function assertCanGenerateFiles(proposalStatus: ProposalStatus | string): void {
  if (proposalStatus !== "APPROVED") {
    throw new GovernanceError(
      "PROPOSAL_APPROVAL_REQUIRED",
      "Generated files can only be created after founder approval."
    );
  }
}

export function assertProposalNotTerminal(
  proposal: Pick<Proposal, "status">,
  action: string
): void {
  if (proposal.status === "REJECTED") {
    throw new GovernanceError(
      "PROPOSAL_ALREADY_REJECTED",
      `Cannot ${action} a rejected proposal.`
    );
  }
  if (proposal.status === "APPROVED") {
    throw new GovernanceError(
      "PROPOSAL_ALREADY_APPROVED",
      `Cannot ${action} an already approved proposal.`
    );
  }
}
