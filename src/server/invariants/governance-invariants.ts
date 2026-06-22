import type { DecisionAction, ProposalStatus } from "@prisma/client";
import { GovernanceError } from "@/server/errors/governance-error";

const VALID_TRANSITIONS: Record<ProposalStatus, ProposalStatus[]> = {
  PENDING: ["APPROVED", "REJECTED", "CHANGES_REQUESTED"],
  APPROVED: [],
  REJECTED: [],
  CHANGES_REQUESTED: ["PENDING"],
};

export function assertValidProposalTransition(
  currentStatus: ProposalStatus,
  targetStatus: ProposalStatus
): void {
  const allowed = VALID_TRANSITIONS[currentStatus];
  if (!allowed.includes(targetStatus)) {
    throw new GovernanceError(
      "INVALID_PROPOSAL_TRANSITION",
      `Invalid proposal transition: ${currentStatus} → ${targetStatus}`
    );
  }
}

export function assertCannotApproveRejected(
  status: ProposalStatus,
  action: DecisionAction
): void {
  if (status === "REJECTED" && action === "APPROVED") {
    throw new GovernanceError(
      "CANNOT_APPROVE_REJECTED",
      "Cannot approve a proposal that has been rejected."
    );
  }
}

export function actionToStatus(action: DecisionAction): ProposalStatus {
  const map: Record<DecisionAction, ProposalStatus> = {
    APPROVED: "APPROVED",
    REJECTED: "REJECTED",
    CHANGES_REQUESTED: "CHANGES_REQUESTED",
  };
  return map[action];
}
